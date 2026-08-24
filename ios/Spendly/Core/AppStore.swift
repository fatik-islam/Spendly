import Foundation
import Observation

@MainActor
@Observable
final class AppStore {
    let client: InsForgeClient

    var sessionState: AppSessionState = .launching
    var currentUser: AuthUser?
    var authConfig: AuthConfig = .fallback
    var profile: Profile?
    var accounts: [Account] = []
    var categories: [Category] = []
    var transactions: [Transaction] = []
    var budgets: [Budget] = []
    var goals: [SavingsGoal] = []
    var recurringTransactions: [RecurringTransaction] = []
    var reminders: [RecurringReminder] = []
    var isLoading = false
    var errorMessage: String?
    var noticeMessage: String?

    private var hasStarted = false
    private let calendar = Calendar.current

    init(client: InsForgeClient = InsForgeClient()) {
        self.client = client
        NotificationService.shared.onDeviceTokenReceived = { [weak self] token, environment in
            Task { @MainActor in
                await self?.registerPushToken(token, environment: environment)
            }
        }
    }

    func start() async {
        guard !hasStarted else { return }
        hasStarted = true
        authConfig = (try? await client.publicAuthConfig()) ?? .fallback

        if ProcessInfo.processInfo.arguments.contains("-SPENDLY_DEMO_UI") {
            loadPreviewWorkspace()
            sessionState = .signedIn
            return
        }

        do {
            if let restored = try await client.restoreSession() {
                currentUser = restored.user
                sessionState = .signedIn
                try await bootstrapAndLoad()
            } else {
                sessionState = .signedOut
            }
        } catch {
            sessionState = .signedOut
            present(error)
        }
    }

    func signIn(email: String, password: String, rememberMe: Bool) async -> Bool {
        await runLoading {
            let session = try await client.signIn(
                email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                password: password,
                rememberMe: rememberMe
            )
            currentUser = session.user
            sessionState = .signedIn
            try await bootstrapAndLoad()
            noticeMessage = "Welcome back."
        }
    }

    func signUp(name: String, email: String, password: String) async throws -> SignUpOutcome {
        guard name.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2 else {
            throw SpendlyError.validation("Full name must be at least 2 characters.")
        }
        try validateEmail(email)
        try validatePassword(password)

        isLoading = true
        defer { isLoading = false }
        let response = try await client.signUp(
            email: email.trimmingCharacters(in: .whitespacesAndNewlines),
            password: password,
            name: name.trimmingCharacters(in: .whitespacesAndNewlines)
        )

        if let user = response.user, response.accessToken != nil {
            currentUser = user
            sessionState = .signedIn
            try await bootstrapAndLoad()
            return .authenticated
        }
        return .verificationRequired(email: email)
    }

    func verifyEmail(email: String, code: String) async -> Bool {
        await runLoading {
            guard code.count == 6 else { throw SpendlyError.validation("Enter the 6-digit verification code.") }
            let session = try await client.verifyEmail(email: email, code: code)
            currentUser = session.user
            sessionState = .signedIn
            try await bootstrapAndLoad()
            noticeMessage = "Email verified."
        }
    }

    func resendVerification(email: String) async -> Bool {
        await runLoading {
            try await client.resendVerification(email: email)
            noticeMessage = "Verification code sent."
        }
    }

    func sendPasswordReset(email: String) async -> Bool {
        await runLoading {
            try validateEmail(email)
            try await client.sendPasswordReset(email: email)
            noticeMessage = "Reset code sent."
        }
    }

    func resetPassword(email: String, code: String, newPassword: String) async -> Bool {
        await runLoading {
            guard code.count == 6 else { throw SpendlyError.validation("Enter the 6-digit reset code.") }
            try validatePassword(newPassword)
            try await client.resetPassword(email: email, code: code, newPassword: newPassword)
            noticeMessage = "Password updated. Sign in with your new password."
        }
    }

    func signOut() async {
        isLoading = true
        await unregisterCurrentPushToken()
        await client.signOut()
        await NotificationService.shared.clearAll()
        clearWorkspace()
        currentUser = nil
        sessionState = .signedOut
        isLoading = false
    }

    func deleteCurrentUserAccount() async -> Bool {
        isLoading = true
        defer { isLoading = false }
        do {
            try await client.deleteCurrentUserAccount()
            await NotificationService.shared.clearAll()
            clearWorkspace()
            currentUser = nil
            sessionState = .signedOut
            noticeMessage = "Your Spendly account and data were permanently deleted."
            return true
        } catch {
            present(error)
            return false
        }
    }

    func refreshAll() async {
        guard sessionState == .signedIn else { return }
        _ = await runLoading {
            try await loadWorkspace()
        }
    }

    func saveAccount(_ draft: AccountDraft) async -> Bool {
        await mutate(success: draft.id == nil ? "Account created." : "Account updated.") {
            let name = draft.name.trimmingCharacters(in: .whitespacesAndNewlines)
            guard name.count >= 2 else { throw SpendlyError.validation("Account name must be at least 2 characters.") }
            let values: [String: JSONValue] = [
                "name": .string(name), "type": .string(draft.type.rawValue),
                "balance": .number(draft.balance), "currency": .string(draft.currency.rawValue)
            ]
            if let id = draft.id {
                try await client.update("accounts", values: values, filters: [.eq("id", id)])
            } else {
                guard let userID = currentUser?.id else { throw SpendlyError.missingSession }
                try await client.insert("accounts", rows: [values.merging(["user_id": .string(userID)]) { left, _ in left }])
            }
        }
    }

    func deleteAccount(_ account: Account) async -> Bool {
        await mutate(success: "Account deleted.") {
            let hasLedger = transactions.contains { $0.accountID == account.id || $0.transferAccountID == account.id }
            guard !hasLedger else { throw SpendlyError.validation("Accounts with transaction history cannot be deleted.") }
            guard !recurringTransactions.contains(where: { $0.accountID == account.id }) else {
                throw SpendlyError.validation("Remove recurring items from this account first.")
            }
            try await client.delete("accounts", filters: [.eq("id", account.id)])
        }
    }

    func saveTransaction(_ draft: TransactionDraft) async -> Bool {
        await mutate(success: draft.id == nil ? "Transaction saved." : "Transaction updated.") {
            guard !draft.accountID.isEmpty else { throw SpendlyError.validation("Choose an account.") }
            guard draft.amount > 0 else { throw SpendlyError.validation("Amount must be greater than zero.") }
            let description = draft.description.trimmingCharacters(in: .whitespacesAndNewlines)
            guard description.count >= 2 else { throw SpendlyError.validation("Description must be at least 2 characters.") }
            if draft.type == .transfer {
                guard let destination = draft.transferAccountID, destination != draft.accountID else {
                    throw SpendlyError.validation("Choose a different destination account.")
                }
            } else if draft.categoryID == nil {
                throw SpendlyError.validation("Choose a category.")
            }

            let values: [String: JSONValue] = [
                "account_id": .string(draft.accountID),
                "transfer_account_id": draft.type == .transfer ? .string(draft.transferAccountID ?? "") : .null,
                "category_id": draft.type == .transfer ? .null : .string(draft.categoryID ?? ""),
                "type": .string(draft.type.rawValue), "amount": .number(draft.amount),
                "description": .string(description),
                "notes": draft.notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? .null : .string(draft.notes),
                "transaction_date": .string(draft.transactionDate.spendlyDateString),
                "is_recurring": .boolean(draft.isRecurring)
            ]
            if let id = draft.id {
                try await client.update("transactions", values: values, filters: [.eq("id", id)])
            } else {
                guard let userID = currentUser?.id else { throw SpendlyError.missingSession }
                try await client.insert("transactions", rows: [values.merging(["user_id": .string(userID)]) { left, _ in left }])
            }
        }
    }

    func deleteTransaction(_ transaction: Transaction) async -> Bool {
        await mutate(success: "Transaction deleted.") {
            try await client.delete("transactions", filters: [.eq("id", transaction.id)])
        }
    }

    func saveBudget(_ draft: BudgetDraft) async -> Bool {
        await mutate(success: draft.id == nil ? "Budget created." : "Budget updated.") {
            guard !draft.categoryID.isEmpty else { throw SpendlyError.validation("Choose a category.") }
            guard draft.amount > 0 else { throw SpendlyError.validation("Amount must be greater than zero.") }
            guard (1...12).contains(draft.month), (2024...2100).contains(draft.year) else {
                throw SpendlyError.validation("Choose a valid budget month and year.")
            }
            let values: [String: JSONValue] = [
                "category_id": .string(draft.categoryID), "amount": .number(draft.amount),
                "month": .integer(draft.month), "year": .integer(draft.year)
            ]
            if let id = draft.id {
                try await client.update("budgets", values: values, filters: [.eq("id", id)])
            } else {
                guard let userID = currentUser?.id else { throw SpendlyError.missingSession }
                try await client.insert("budgets", rows: [values.merging(["user_id": .string(userID)]) { left, _ in left }])
            }
        }
    }

    func deleteBudget(_ budget: Budget) async -> Bool {
        await mutate(success: "Budget deleted.") { try await client.delete("budgets", filters: [.eq("id", budget.id)]) }
    }

    func saveGoal(_ draft: GoalDraft) async -> Bool {
        await mutate(success: draft.id == nil ? "Goal created." : "Goal updated.") {
            let name = draft.name.trimmingCharacters(in: .whitespacesAndNewlines)
            guard name.count >= 2 else { throw SpendlyError.validation("Goal name must be at least 2 characters.") }
            guard draft.targetAmount > 0, draft.currentAmount >= 0 else { throw SpendlyError.validation("Enter valid goal amounts.") }
            let values: [String: JSONValue] = [
                "name": .string(name), "target_amount": .number(draft.targetAmount),
                "current_amount": .number(draft.currentAmount),
                "deadline": draft.deadline.map { .string($0.spendlyDateString) } ?? .null
            ]
            if let id = draft.id {
                try await client.update("savings_goals", values: values, filters: [.eq("id", id)])
            } else {
                guard let userID = currentUser?.id else { throw SpendlyError.missingSession }
                try await client.insert("savings_goals", rows: [values.merging(["user_id": .string(userID)]) { left, _ in left }])
            }
        }
    }

    func deleteGoal(_ goal: SavingsGoal) async -> Bool {
        await mutate(success: "Goal deleted.") { try await client.delete("savings_goals", filters: [.eq("id", goal.id)]) }
    }

    func saveRecurring(_ draft: RecurringDraft) async -> Bool {
        await mutate(success: draft.id == nil ? "Recurring item created." : "Recurring item updated.") {
            guard draft.type != .transfer else { throw SpendlyError.validation("Recurring transfers are not supported.") }
            guard !draft.accountID.isEmpty, draft.categoryID != nil else { throw SpendlyError.validation("Choose an account and category.") }
            guard draft.amount > 0, draft.description.trimmingCharacters(in: .whitespaces).count >= 2 else {
                throw SpendlyError.validation("Enter a description and positive amount.")
            }
            let values: [String: JSONValue] = [
                "account_id": .string(draft.accountID), "category_id": .string(draft.categoryID ?? ""),
                "type": .string(draft.type.rawValue), "amount": .number(draft.amount),
                "description": .string(draft.description.trimmingCharacters(in: .whitespacesAndNewlines)),
                "frequency": .string(draft.frequency.rawValue),
                "next_due_date": .string(draft.nextDueDate.spendlyDateString), "active": .boolean(draft.active)
            ]
            if let id = draft.id {
                try await client.update("recurring_transactions", values: values, filters: [.eq("id", id)])
                try await client.delete("recurring_reminders", filters: [.eq("recurring_transaction_id", id), .isNull("dismissed_at")])
            } else {
                guard let userID = currentUser?.id else { throw SpendlyError.missingSession }
                try await client.insert("recurring_transactions", rows: [values.merging(["user_id": .string(userID)]) { left, _ in left }])
            }
            if draft.active { try await generateReminders() }
        }
    }

    func toggleRecurring(_ item: RecurringTransaction) async -> Bool {
        await mutate(success: item.active ? "Recurring item paused." : "Recurring item resumed.") {
            try await client.update("recurring_transactions", values: ["active": .boolean(!item.active)], filters: [.eq("id", item.id)])
            if item.active {
                try await client.delete("recurring_reminders", filters: [.eq("recurring_transaction_id", item.id), .isNull("dismissed_at")])
            } else {
                try await generateReminders()
            }
        }
    }

    func deleteRecurring(_ item: RecurringTransaction) async -> Bool {
        await mutate(success: "Recurring item deleted.") { try await client.delete("recurring_transactions", filters: [.eq("id", item.id)]) }
    }

    func saveCategory(_ draft: CategoryDraft) async -> Bool {
        await mutate(success: draft.id == nil ? "Category created." : "Category updated.") {
            let name = draft.name.trimmingCharacters(in: .whitespacesAndNewlines)
            guard name.count >= 2 else { throw SpendlyError.validation("Category name must be at least 2 characters.") }
            let values: [String: JSONValue] = [
                "name": .string(name), "type": .string(draft.type.rawValue),
                "color": .string(draft.color), "icon": .string(draft.icon)
            ]
            if let id = draft.id {
                guard categories.first(where: { $0.id == id })?.isDefault == false else {
                    throw SpendlyError.validation("Default categories cannot be edited.")
                }
                try await client.update("categories", values: values, filters: [.eq("id", id), .equals("is_default", "false")])
            } else {
                guard let userID = currentUser?.id else { throw SpendlyError.missingSession }
                let row = values.merging(["user_id": .string(userID), "is_default": .boolean(false)]) { left, _ in left }
                try await client.insert("categories", rows: [row])
            }
        }
    }

    func deleteCategory(_ category: Category) async -> Bool {
        await mutate(success: "Category deleted.") {
            guard !category.isDefault else { throw SpendlyError.validation("Default categories cannot be deleted.") }
            try await client.delete("categories", filters: [.eq("id", category.id)])
        }
    }

    func updateProfile(name: String, currency: CurrencyCode) async -> Bool {
        await mutate(success: "Profile updated.") {
            guard name.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2 else {
                throw SpendlyError.validation("Name must be at least 2 characters.")
            }
            try await client.update(
                "profiles",
                values: ["full_name": .string(name), "currency": .string(currency.rawValue)],
                filters: [.eq("user_id", currentUser?.id ?? "")]
            )
        }
    }

    func updateReminderPreferences(days: Int, inApp: Bool, email: Bool) async -> Bool {
        await mutate(success: "Reminder preferences updated.") {
            guard (0...30).contains(days) else { throw SpendlyError.validation("Lead time must be between 0 and 30 days.") }
            guard inApp || !email else { throw SpendlyError.validation("Enable in-app reminders before email reminders.") }
            try await client.update(
                "profiles",
                values: [
                    "reminder_days_before": .integer(days),
                    "reminder_in_app_enabled": .boolean(inApp),
                    "reminder_email_enabled": .boolean(email)
                ],
                filters: [.eq("user_id", currentUser?.id ?? "")]
            )
            try await client.delete("recurring_reminders", filters: [.isNull("dismissed_at"), .isNull("read_at")])
            if inApp { try await generateReminders() }
        }
    }

    func markReminderRead(_ reminder: RecurringReminder) async -> Bool {
        await mutate(success: "Reminder marked as read.") {
            try await client.update(
                "recurring_reminders",
                values: ["read_at": .string(ISO8601DateFormatter().string(from: Date()))],
                filters: [.eq("id", reminder.id), .isNull("dismissed_at")]
            )
        }
    }

    func dismissReminder(_ reminder: RecurringReminder) async -> Bool {
        await mutate(success: "Reminder dismissed.") {
            let now = ISO8601DateFormatter().string(from: Date())
            try await client.update(
                "recurring_reminders",
                values: ["read_at": .string(now), "dismissed_at": .string(now)],
                filters: [.eq("id", reminder.id)]
            )
        }
    }

    func loadDemoWorkspace() async -> Bool {
        await mutate(success: "Demo workspace loaded.") {
            let _: DemoSeedResult = try await client.rpc("seed_spendly_demo_workspace")
        }
    }

    var currency: CurrencyCode { profile?.currency ?? .usd }
    var totalBalance: Double { accounts.reduce(0) { $0 + $1.balance } }
    var currentMonthTransactions: [Transaction] {
        transactions.filter { item in
            guard let date = item.transactionDate.spendlyDate else { return false }
            return calendar.isDate(date, equalTo: Date(), toGranularity: .month)
        }
    }
    var monthlyIncome: Double { currentMonthTransactions.filter { $0.type == .income }.reduce(0) { $0 + $1.amount } }
    var monthlyExpenses: Double { currentMonthTransactions.filter { $0.type == .expense }.reduce(0) { $0 + $1.amount } }
    var netSavings: Double { monthlyIncome - monthlyExpenses }
    var savingsRate: Double { monthlyIncome > 0 ? max(0, min(100, netSavings / monthlyIncome * 100)) : 0 }
    var unreadReminders: [RecurringReminder] { reminders.filter { $0.readAt == nil && $0.dismissedAt == nil } }
    var canLoadDemoData: Bool {
        accounts.allSatisfy { abs($0.balance) < 0.001 } && transactions.isEmpty && budgets.isEmpty && goals.isEmpty && recurringTransactions.isEmpty
    }

    var currentBudgetProgress: [BudgetProgress] {
        let month = calendar.component(.month, from: Date())
        let year = calendar.component(.year, from: Date())
        return budgets.filter { $0.month == month && $0.year == year }.map { budget in
            let spent = currentMonthTransactions.filter { $0.type == .expense && $0.categoryID == budget.categoryID }.reduce(0) { $0 + $1.amount }
            return BudgetProgress(
                id: budget.id,
                budget: budget,
                category: category(id: budget.categoryID),
                spent: spent,
                progress: budget.amount > 0 ? min(130, spent / budget.amount * 100) : 0
            )
        }.sorted { $0.progress > $1.progress }
    }

    var categorySpending: [CategorySpend] {
        Dictionary(grouping: currentMonthTransactions.filter { $0.type == .expense && $0.categoryID != nil }, by: { $0.categoryID! })
            .compactMap { id, items in
                guard let category = category(id: id) else { return nil }
                return CategorySpend(id: id, name: category.name, color: category.color, amount: items.reduce(0) { $0 + $1.amount })
            }.sorted { $0.amount > $1.amount }
    }

    var sixMonthCashFlow: [MonthlyCashFlow] { cashFlow(months: 6) }
    var twelveMonthCashFlow: [MonthlyCashFlow] { cashFlow(months: 12) }
    var financialHealthScore: Int {
        let balanceScore = totalBalance > 0 ? 28.0 : 10.0
        let savingsScore = min(30, max(0, savingsRate))
        let spendingScore = monthlyExpenses > 0 ? min(22, max(6, 22 - monthlyExpenses / 150)) : 18
        let budgetEfficiency = currentBudgetProgress.isEmpty ? 14 : currentBudgetProgress.reduce(0) { $0 + min(100, max(0, 100 - $1.progress)) } / Double(currentBudgetProgress.count) / 5
        return Int(min(100, max(0, balanceScore + savingsScore + spendingScore + budgetEfficiency)).rounded())
    }

    func account(id: String?) -> Account? { accounts.first { $0.id == id } }
    func category(id: String?) -> Category? { categories.first { $0.id == id } }

    private func bootstrapAndLoad() async throws {
        guard let user = currentUser else { throw SpendlyError.missingSession }
        try await client.rpcVoid("bootstrap_spendly_user", arguments: [
            "p_full_name": .string(user.profile?.name ?? ""), "p_currency": .string("USD")
        ])
        try await loadWorkspace()
        if let token = NotificationService.shared.currentDeviceToken {
            await registerPushToken(token, environment: NotificationService.shared.environment)
        }
    }

    func loadWorkspace() async throws {
        try await generateReminders()
        async let profileRows: [Profile] = client.fetchRows("profiles", order: "created_at.desc")
        async let accountRows: [Account] = client.fetchRows("accounts", order: "created_at.asc")
        async let categoryRows: [Category] = client.fetchRows("categories", order: "created_at.asc")
        async let transactionRows: [Transaction] = client.fetchRows("transactions", order: "transaction_date.desc,created_at.desc")
        async let budgetRows: [Budget] = client.fetchRows("budgets", order: "updated_at.desc")
        async let goalRows: [SavingsGoal] = client.fetchRows("savings_goals", order: "updated_at.desc")
        async let recurringRows: [RecurringTransaction] = client.fetchRows("recurring_transactions", order: "next_due_date.asc")
        async let reminderRows: [RecurringReminder] = client.fetchRows(
            "recurring_reminders",
            order: "due_date.asc,created_at.desc",
            filters: [.isNull("dismissed_at")]
        )
        let loaded = try await (profileRows, accountRows, categoryRows, transactionRows, budgetRows, goalRows, recurringRows, reminderRows)
        profile = loaded.0.first
        accounts = loaded.1
        categories = loaded.2
        transactions = loaded.3
        budgets = loaded.4
        goals = loaded.5
        recurringTransactions = loaded.6
        reminders = loaded.7
        await NotificationService.shared.sync(
            reminders: reminders,
            recurringTransactions: recurringTransactions,
            reminderDaysBefore: profile?.reminderDaysBefore ?? 3,
            enabled: profile?.reminderInAppEnabled ?? true
        )
    }

    private func generateReminders() async throws {
        guard let userID = currentUser?.id else { return }
        let _: Int = try await client.rpc("generate_recurring_reminders", arguments: ["p_target_user_id": .string(userID)])
    }

    private func registerPushToken(_ token: String, environment: String) async {
        guard sessionState == .signedIn else { return }
        try? await client.rpcVoid("register_apns_device_token", arguments: [
            "p_device_token": .string(token),
            "p_environment": .string(environment)
        ])
    }

    private func unregisterCurrentPushToken() async {
        guard let token = NotificationService.shared.currentDeviceToken else { return }
        try? await client.rpcVoid("unregister_apns_device_token", arguments: [
            "p_device_token": .string(token)
        ])
    }

    func mutate(success: String, operation: () async throws -> Void) async -> Bool {
        await runLoading {
            try await operation()
            try await loadWorkspace()
            noticeMessage = success
        }
    }

    private func runLoading(_ operation: () async throws -> Void) async -> Bool {
        isLoading = true
        defer { isLoading = false }
        do {
            try await operation()
            return true
        } catch {
            present(error)
            return false
        }
    }

    private func validateEmail(_ email: String) throws {
        guard email.contains("@"), email.contains(".") else { throw SpendlyError.validation("Enter a valid email address.") }
    }

    private func validatePassword(_ password: String) throws {
        guard password.count >= authConfig.passwordMinLength else {
            throw SpendlyError.validation("Password must be at least \(authConfig.passwordMinLength) characters.")
        }
    }

    private func present(_ error: Error) {
        errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
    }

    private func clearWorkspace() {
        profile = nil; accounts = []; categories = []; transactions = []; budgets = []
        goals = []; recurringTransactions = []; reminders = []
    }

    private func cashFlow(months: Int) -> [MonthlyCashFlow] {
        let start = calendar.date(from: calendar.dateComponents([.year, .month], from: Date())) ?? Date()
        return (0..<months).reversed().compactMap { offset in
            guard let date = calendar.date(byAdding: .month, value: -offset, to: start) else { return nil }
            let items = transactions.filter { item in
                guard let itemDate = item.transactionDate.spendlyDate else { return false }
                return calendar.isDate(itemDate, equalTo: date, toGranularity: .month)
            }
            let income = items.filter { $0.type == .income }.reduce(0) { $0 + $1.amount }
            let expense = items.filter { $0.type == .expense }.reduce(0) { $0 + $1.amount }
            return MonthlyCashFlow(id: date.spendlyDateString, label: date.formatted(.dateTime.month(.abbreviated)), income: income, expense: expense)
        }
    }
}

extension URLQueryItem {
    static func eq(_ column: String, _ value: String) -> URLQueryItem { URLQueryItem(name: column, value: "eq.\(value)") }
    static func equals(_ column: String, _ value: String) -> URLQueryItem { URLQueryItem(name: column, value: "eq.\(value)") }
    static func isNull(_ column: String) -> URLQueryItem { URLQueryItem(name: column, value: "is.null") }
}
