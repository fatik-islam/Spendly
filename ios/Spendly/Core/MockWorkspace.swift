import Foundation

extension AppStore {
    func loadPreviewWorkspace() {
        let userID = "00000000-0000-0000-0000-000000000001"
        currentUser = AuthUser(id: userID, email: "alex@spendly.app", emailVerified: true, profile: .init(name: "Alex Morgan", avatarURL: nil))
        profile = Profile(
            id: "profile", userID: userID, fullName: "Alex Morgan", currency: .pkr,
            reminderDaysBefore: 3, reminderInAppEnabled: true, reminderEmailEnabled: false,
            createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z"
        )
        accounts = [
            Account(id: "bank", userID: userID, name: "Bank", type: .bank, balance: 214_500, currency: .pkr, createdAt: "", updatedAt: ""),
            Account(id: "cash", userID: userID, name: "Cash", type: .cash, balance: 18_200, currency: .pkr, createdAt: "", updatedAt: ""),
            Account(id: "saving", userID: userID, name: "Savings", type: .savings, balance: 125_000, currency: .pkr, createdAt: "", updatedAt: "")
        ]
        categories = [
            Category(id: "food", userID: userID, name: "Food", type: .expense, color: "#F97316", icon: "utensils-crossed", isDefault: true, createdAt: ""),
            Category(id: "rent", userID: userID, name: "Rent", type: .expense, color: "#14B8A6", icon: "house", isDefault: true, createdAt: ""),
            Category(id: "salary", userID: userID, name: "Salary", type: .income, color: "#22C55E", icon: "briefcase-business", isDefault: true, createdAt: ""),
            Category(id: "travel", userID: userID, name: "Travel", type: .expense, color: "#8B5CF6", icon: "plane", isDefault: true, createdAt: "")
        ]
        let today = Date()
        transactions = [
            Transaction(id: "t1", userID: userID, accountID: "bank", transferAccountID: nil, categoryID: "salary", type: .income, amount: 320_000, description: "Monthly Salary", notes: "Primary deposit", transactionDate: today.spendlyDateString, isRecurring: true, createdAt: "", updatedAt: ""),
            Transaction(id: "t2", userID: userID, accountID: "bank", transferAccountID: nil, categoryID: "rent", type: .expense, amount: 95_000, description: "Apartment Rent", notes: nil, transactionDate: today.spendlyDateString, isRecurring: true, createdAt: "", updatedAt: ""),
            Transaction(id: "t3", userID: userID, accountID: "cash", transferAccountID: nil, categoryID: "food", type: .expense, amount: 12_800, description: "Dinner and pantry run", notes: "Family dinner", transactionDate: today.spendlyDateString, isRecurring: false, createdAt: "", updatedAt: ""),
            Transaction(id: "t4", userID: userID, accountID: "bank", transferAccountID: "saving", categoryID: nil, type: .transfer, amount: 40_000, description: "Move money to savings", notes: nil, transactionDate: today.spendlyDateString, isRecurring: false, createdAt: "", updatedAt: "")
        ]
        budgets = [
            Budget(id: "b1", userID: userID, categoryID: "rent", amount: 95_000, month: Calendar.current.component(.month, from: today), year: Calendar.current.component(.year, from: today), createdAt: "", updatedAt: ""),
            Budget(id: "b2", userID: userID, categoryID: "food", amount: 25_000, month: Calendar.current.component(.month, from: today), year: Calendar.current.component(.year, from: today), createdAt: "", updatedAt: "")
        ]
        goals = [
            SavingsGoal(id: "g1", userID: userID, name: "Emergency Fund", targetAmount: 500_000, currentAmount: 125_000, deadline: Calendar.current.date(byAdding: .day, value: 210, to: today)?.spendlyDateString, createdAt: "", updatedAt: "")
        ]
        recurringTransactions = [
            RecurringTransaction(id: "r1", userID: userID, accountID: "bank", categoryID: "food", type: .expense, amount: 4_500, description: "Internet Bill", frequency: .monthly, nextDueDate: Calendar.current.date(byAdding: .day, value: 5, to: today)?.spendlyDateString ?? today.spendlyDateString, active: true, createdAt: "", updatedAt: "")
        ]
        reminders = [
            RecurringReminder(id: "n1", userID: userID, recurringTransactionID: "r1", kind: "upcoming", title: "Internet Bill is due soon", body: "Internet Bill is due in five days.", dueDate: recurringTransactions[0].nextDueDate, remindOn: today.spendlyDateString, emailSentAt: nil, emailLastError: nil, readAt: nil, dismissedAt: nil, createdAt: "")
        ]
    }
}
