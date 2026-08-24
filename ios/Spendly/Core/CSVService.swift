import Foundation

enum ExportDataset: String, CaseIterable, Identifiable, Sendable {
    case profile, accounts, categories, transactions, budgets, goals, recurring
    var id: String { rawValue }
    var title: String {
        switch self {
        case .profile: "Profile"
        case .accounts: "Accounts"
        case .categories: "Categories"
        case .transactions: "Transactions"
        case .budgets: "Budgets"
        case .goals: "Savings goals"
        case .recurring: "Recurring"
        }
    }
}

struct CSVImportSummary: Sendable {
    let processed: Int
    let imported: Int
    let duplicates: Int
    let errors: [String]
    let createdAccounts: [String]
    let createdCategories: [String]

    var message: String {
        var parts = ["Imported \(imported) transaction\(imported == 1 ? "" : "s")."]
        if duplicates > 0 { parts.append("Skipped \(duplicates) duplicate\(duplicates == 1 ? "" : "s").") }
        if !errors.isEmpty { parts.append("\(errors.count) row\(errors.count == 1 ? "" : "s") need attention.") }
        return parts.joined(separator: " ")
    }
}

@MainActor
enum CSVService {
    static func export(_ dataset: ExportDataset, from store: AppStore) throws -> URL {
        let content = csv(rows: exportRows(dataset, store: store))
        let directory = FileManager.default.temporaryDirectory.appending(path: "SpendlyExports", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let file = directory.appending(path: "spendly-\(dataset.rawValue)-\(Date().spendlyDateString).csv")
        try content.write(to: file, atomically: true, encoding: .utf8)
        return file
    }

    static func parse(_ text: String) -> [[String]] {
        var rows: [[String]] = []
        var row: [String] = []
        var value = ""
        var quoted = false
        var index = text.startIndex

        while index < text.endIndex {
            let character = text[index]
            let next = text.index(after: index)
            if character == "\"" {
                if quoted, next < text.endIndex, text[next] == "\"" {
                    value.append("\"")
                    index = text.index(after: next)
                    continue
                }
                quoted.toggle()
            } else if character == ",", !quoted {
                row.append(value); value = ""
            } else if character.isNewline, !quoted {
                if character == "\r", next < text.endIndex, text[next] == "\n" { index = next }
                row.append(value); value = ""
                if row.contains(where: { !$0.trimmingCharacters(in: .whitespaces).isEmpty }) { rows.append(row) }
                row = []
            } else {
                value.append(character)
            }
            index = text.index(after: index)
        }
        if !value.isEmpty || !row.isEmpty {
            row.append(value)
            if row.contains(where: { !$0.trimmingCharacters(in: .whitespaces).isEmpty }) { rows.append(row) }
        }
        return rows
    }

    private static func exportRows(_ dataset: ExportDataset, store: AppStore) -> [[String]] {
        switch dataset {
        case .profile:
            let p = store.profile
            return [["Email", "Full Name", "Currency", "Reminder Days Before", "In-App Reminders", "Email Reminders"], [
                store.currentUser?.email ?? "", p?.fullName ?? "", store.currency.rawValue,
                "\(p?.reminderDaysBefore ?? 3)", yesNo(p?.reminderInAppEnabled ?? true), yesNo(p?.reminderEmailEnabled ?? false)
            ]]
        case .accounts:
            return [["Name", "Type", "Balance", "Currency", "Created At", "Updated At"]] + store.accounts.map {
                [$0.name, $0.type.rawValue, String(format: "%.2f", $0.balance), $0.currency.rawValue, $0.createdAt, $0.updatedAt]
            }
        case .categories:
            return [["Name", "Type", "Color", "Icon", "Default", "Created At"]] + store.categories.map {
                [$0.name, $0.type.rawValue, $0.color, $0.icon, yesNo($0.isDefault), $0.createdAt]
            }
        case .transactions:
            return [["Date", "Type", "Description", "Amount", "Currency", "Account", "Account Type", "Destination Account", "Destination Account Type", "Category", "Notes", "Recurring", "Created At", "Updated At"]] + store.transactions.map { item in
                let source = store.account(id: item.accountID)
                let destination = store.account(id: item.transferAccountID)
                return [item.transactionDate, item.type.rawValue, item.description, String(format: "%.2f", item.amount), store.currency.rawValue,
                        source?.name ?? "", source?.type.rawValue ?? "", destination?.name ?? "", destination?.type.rawValue ?? "",
                        store.category(id: item.categoryID)?.name ?? "", item.notes ?? "", yesNo(item.isRecurring), item.createdAt, item.updatedAt]
            }
        case .budgets:
            return [["Category", "Amount", "Currency", "Month", "Year", "Created At", "Updated At"]] + store.budgets.map {
                [store.category(id: $0.categoryID)?.name ?? "", String(format: "%.2f", $0.amount), store.currency.rawValue, "\($0.month)", "\($0.year)", $0.createdAt, $0.updatedAt]
            }
        case .goals:
            return [["Name", "Target Amount", "Current Amount", "Currency", "Deadline", "Created At", "Updated At"]] + store.goals.map {
                [$0.name, String(format: "%.2f", $0.targetAmount), String(format: "%.2f", $0.currentAmount), store.currency.rawValue, $0.deadline ?? "", $0.createdAt, $0.updatedAt]
            }
        case .recurring:
            return [["Type", "Description", "Amount", "Currency", "Frequency", "Next Due Date", "Account", "Account Type", "Category", "Active", "Created At", "Updated At"]] + store.recurringTransactions.map {
                [$0.type.rawValue, $0.description, String(format: "%.2f", $0.amount), store.currency.rawValue, $0.frequency.rawValue, $0.nextDueDate,
                 store.account(id: $0.accountID)?.name ?? "", store.account(id: $0.accountID)?.type.rawValue ?? "", store.category(id: $0.categoryID)?.name ?? "", yesNo($0.active), $0.createdAt, $0.updatedAt]
            }
        }
    }

    private static func csv(rows: [[String]]) -> String {
        rows.map { row in row.map { field in
            if field.contains(",") || field.contains("\"") || field.contains("\n") {
                return "\"\(field.replacingOccurrences(of: "\"", with: "\"\""))\""
            }
            return field
        }.joined(separator: ",") }.joined(separator: "\n")
    }

    private static func yesNo(_ value: Bool) -> String { value ? "Yes" : "No" }
}

extension AppStore {
    func importTransactions(from url: URL) async -> CSVImportSummary? {
        var summary: CSVImportSummary?
        let success = await mutate(success: "CSV import complete.") {
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            let text = try String(contentsOf: url, encoding: .utf8)
            let rows = CSVService.parse(text)
            guard rows.count >= 2 else { throw SpendlyError.validation("The CSV needs a header and at least one transaction row.") }
            guard rows.count <= 5001 else { throw SpendlyError.validation("Import up to 5,000 transaction rows at a time.") }

            let headers = rows[0].map(normalizeHeader)
            func column(_ aliases: [String]) -> Int? { headers.firstIndex(where: aliases.contains) }
            guard let dateColumn = column(["date", "transactiondate"]),
                  let typeColumn = column(["type", "transactiontype"]),
                  let descriptionColumn = column(["description", "details", "memo"]),
                  let amountColumn = column(["amount", "value"]),
                  let accountColumn = column(["account", "accountname", "sourceaccount"]) else {
                throw SpendlyError.validation("Missing required CSV columns: date, type, description, amount, and account.")
            }
            let destinationColumn = column(["destinationaccount", "destinationaccountname", "transferaccount", "toaccount"])
            let categoryColumn = column(["category", "categoryname"])
            let notesColumn = column(["notes", "note"])
            let recurringColumn = column(["recurring", "isrecurring"])
            let accountTypeColumn = column(["accounttype", "sourceaccounttype"])

            struct Parsed {
                let row: Int; let date: String; let type: TransactionType; let description: String; let amount: Double
                let account: String; let accountType: AccountType; let destination: String?; let category: String?
                let notes: String?; let recurring: Bool
            }
            var parsed: [Parsed] = []
            var errors: [String] = []

            for (offset, row) in rows.dropFirst().enumerated() {
                func field(_ index: Int?) -> String { guard let index, row.indices.contains(index) else { return "" }; return row[index].trimmingCharacters(in: .whitespacesAndNewlines) }
                let rowNumber = offset + 2
                guard let type = TransactionType(rawValue: field(typeColumn).lowercased()),
                      let amount = Double(field(amountColumn).replacingOccurrences(of: "[^0-9.-]", with: "", options: .regularExpression)), amount > 0 else {
                    errors.append("Row \(rowNumber): invalid type or amount."); continue
                }
                let dateText = field(dateColumn)
                let date = dateText.spendlyDate != nil ? dateText : (DateFormatter.spendlyDisplay.date(from: dateText)?.spendlyDateString ?? "")
                let account = field(accountColumn), description = field(descriptionColumn)
                let destination = field(destinationColumn), category = field(categoryColumn)
                guard !date.isEmpty, account.count >= 2, description.count >= 2,
                      type == .transfer ? destination.count >= 2 : category.count >= 2 else {
                    errors.append("Row \(rowNumber): missing required transaction details."); continue
                }
                let explicitType = AccountType(rawValue: field(accountTypeColumn))
                parsed.append(Parsed(row: rowNumber, date: date, type: type, description: description, amount: amount,
                                     account: account, accountType: explicitType ?? inferAccountType(account),
                                     destination: type == .transfer ? destination : nil, category: type == .transfer ? nil : category,
                                     notes: field(notesColumn).isEmpty ? nil : field(notesColumn), recurring: parseBoolean(field(recurringColumn))))
            }

            guard let userID = currentUser?.id else { throw SpendlyError.missingSession }
            let existingAccountNames = Set(accounts.map { $0.name.lowercased() })
            let missingAccounts = Set(parsed.flatMap { [$0.account, $0.destination].compactMap { $0 } }.filter { !existingAccountNames.contains($0.lowercased()) })
            if !missingAccounts.isEmpty {
                let rows = missingAccounts.map { name -> [String: JSONValue] in
                    let type = parsed.first(where: { $0.account.caseInsensitiveCompare(name) == .orderedSame })?.accountType ?? inferAccountType(name)
                    return ["user_id": .string(userID), "name": .string(name), "type": .string(type.rawValue), "balance": .number(0), "currency": .string(currency.rawValue)]
                }
                try await client.insert("accounts", rows: rows)
            }

            let existingCategoryNames = Set(categories.map { "\($0.type.rawValue):\($0.name.lowercased())" })
            let missingCategories = Set(parsed.compactMap { item -> String? in
                guard let category = item.category else { return nil }
                let key = "\(item.type.rawValue):\(category.lowercased())"
                return existingCategoryNames.contains(key) ? nil : "\(item.type.rawValue)|\(category)"
            })
            if !missingCategories.isEmpty {
                let palette = ["#14B8A6", "#22C55E", "#0EA5E9", "#F97316", "#A855F7", "#F43F5E"]
                let rows = missingCategories.enumerated().map { index, value -> [String: JSONValue] in
                    let parts = value.split(separator: "|", maxSplits: 1).map(String.init)
                    let type = parts.first ?? "expense", name = parts.count > 1 ? parts[1] : "Imported"
                    return ["user_id": .string(userID), "name": .string(name), "type": .string(type), "color": .string(palette[index % palette.count]), "icon": .string(type == "income" ? "briefcase-business" : "piggy-bank"), "is_default": .boolean(false)]
                }
                try await client.insert("categories", rows: rows)
            }

            try await loadWorkspace()
            let accountsByName = Dictionary(uniqueKeysWithValues: accounts.map { ($0.name.lowercased(), $0) })
            let categoriesByName = Dictionary(uniqueKeysWithValues: categories.map { ("\($0.type.rawValue):\($0.name.lowercased())", $0) })
            var fingerprints = Set(transactions.map { fingerprint(account: $0.accountID, destination: $0.transferAccountID, category: $0.categoryID, type: $0.type, amount: $0.amount, description: $0.description, date: $0.transactionDate) })
            var payloads: [[String: JSONValue]] = []
            var duplicates = 0

            for item in parsed {
                guard let account = accountsByName[item.account.lowercased()] else { errors.append("Row \(item.row): account could not be resolved."); continue }
                let destination = item.destination.flatMap { accountsByName[$0.lowercased()] }
                let category = item.category.flatMap { categoriesByName["\(item.type.rawValue):\($0.lowercased())"] }
                let key = fingerprint(account: account.id, destination: destination?.id, category: category?.id, type: item.type, amount: item.amount, description: item.description, date: item.date)
                if fingerprints.contains(key) { duplicates += 1; continue }
                fingerprints.insert(key)
                payloads.append([
                    "user_id": .string(userID), "account_id": .string(account.id),
                    "transfer_account_id": destination.map { .string($0.id) } ?? .null,
                    "category_id": category.map { .string($0.id) } ?? .null,
                    "type": .string(item.type.rawValue), "amount": .number(item.amount), "description": .string(item.description),
                    "notes": item.notes.map(JSONValue.string) ?? .null, "transaction_date": .string(item.date), "is_recurring": .boolean(item.recurring)
                ])
            }
            if !payloads.isEmpty { try await client.insert("transactions", rows: payloads) }
            summary = CSVImportSummary(processed: rows.count - 1, imported: payloads.count, duplicates: duplicates, errors: errors, createdAccounts: Array(missingAccounts).sorted(), createdCategories: missingCategories.map { String($0.split(separator: "|", maxSplits: 1).last ?? "") }.sorted())
        }
        if success { noticeMessage = summary?.message }
        return success ? summary : nil
    }
}

private func normalizeHeader(_ value: String) -> String { value.lowercased().filter(\.isLetter) }
private func parseBoolean(_ value: String) -> Bool { ["yes", "true", "1", "y"].contains(value.lowercased()) }
private func inferAccountType(_ name: String) -> AccountType {
    let value = name.lowercased()
    if value.contains("credit") || value.contains("card") { return .creditCard }
    if value.contains("saving") { return .savings }
    if value.contains("cash") { return .cash }
    return .bank
}
private func fingerprint(account: String, destination: String?, category: String?, type: TransactionType, amount: Double, description: String, date: String) -> String {
    [account, destination ?? "", category ?? "", type.rawValue, String(format: "%.2f", amount), description.lowercased(), date].joined(separator: "|")
}
