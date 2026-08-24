import SwiftUI

struct TransactionsView: View {
    @Environment(AppStore.self) private var store
    @State private var search = ""
    @State private var typeFilter: TransactionType?
    @State private var accountFilter: String?
    @State private var categoryFilter: String?
    @State private var dateFilter: Date?
    @State private var editor: TransactionDraft?
    @State private var deleting: Transaction?
    @State private var showsFilters = false

    private var filtered: [Transaction] {
        store.transactions.filter { transaction in
            let term = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            let searchMatch = term.isEmpty || transaction.description.lowercased().contains(term)
                || (transaction.notes?.lowercased().contains(term) ?? false)
                || (store.category(id: transaction.categoryID)?.name.lowercased().contains(term) ?? false)
            let typeMatch = typeFilter == nil || transaction.type == typeFilter
            let accountMatch = accountFilter == nil || transaction.accountID == accountFilter || transaction.transferAccountID == accountFilter
            let categoryMatch = categoryFilter == nil || transaction.categoryID == categoryFilter
            let dateMatch = dateFilter == nil || transaction.transactionDate == dateFilter?.spendlyDateString
            return searchMatch && typeMatch && accountMatch && categoryMatch && dateMatch
        }
    }

    var body: some View {
        List {
            if hasFilters {
                Section {
                    HStack {
                        Label("Filters active", systemImage: "line.3.horizontal.decrease.circle.fill")
                            .font(.subheadline.weight(.semibold)).foregroundStyle(SpendlyTheme.teal)
                        Spacer()
                        Button("Clear") { clearFilters() }
                    }
                }
            }

            Section {
                if filtered.isEmpty {
                    ContentUnavailableView(
                        search.isEmpty ? "No transactions yet" : "No matching transactions",
                        systemImage: "list.bullet.rectangle",
                        description: Text("Add income, expenses, or transfers, then narrow them with search and filters.")
                    )
                } else {
                    ForEach(filtered) { transaction in
                        transactionCell(transaction)
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button(role: .destructive) { deleting = transaction } label: { Label("Delete", systemImage: "trash") }
                                Button { editor = draft(for: transaction) } label: { Label("Edit", systemImage: "pencil") }.tint(SpendlyTheme.teal)
                            }
                    }
                }
            }
        }
        .navigationTitle("Ledger")
        .searchable(text: $search, prompt: "Description, notes, or category")
        .toolbar {
            ToolbarItemGroup(placement: .bottomBar) {
                Button { showsFilters = true } label: { Label("Filters", systemImage: "line.3.horizontal.decrease.circle") }
                Spacer()
                Button { editor = TransactionDraft(accountID: store.accounts.first?.id ?? "") } label: { Label("Add transaction", systemImage: "plus.circle.fill") }
            }
        }
        .sheet(item: $editor) { TransactionEditor(draft: $0) }
        .sheet(isPresented: $showsFilters) {
            TransactionFiltersView(
                type: $typeFilter,
                accountID: $accountFilter,
                categoryID: $categoryFilter,
                date: $dateFilter,
                onClear: clearFilters
            )
        }
        .confirmationDialog("Delete transaction?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible) {
            Button("Delete transaction", role: .destructive) {
                if let deleting { Task { if await store.deleteTransaction(deleting) { self.deleting = nil } } }
            }
            Button("Cancel", role: .cancel) { deleting = nil }
        } message: { Text("Affected account balances will be recalculated automatically.") }
        .refreshable { await store.refreshAll() }
        .spendlyPage()
    }

    private func transactionCell(_ transaction: Transaction) -> some View {
        HStack(spacing: 12) {
            let category = store.category(id: transaction.categoryID)
            let color = SpendlyTheme.color(hex: category?.color ?? "#14B8A6")
            Image(systemName: transaction.type == .transfer ? "arrow.left.arrow.right" : CategorySymbol.systemName(for: category?.icon))
                .foregroundStyle(color).frame(width: 42, height: 42)
                .background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: 14))
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(transaction.description).font(.headline).lineLimit(1)
                    if transaction.isRecurring { Image(systemName: "repeat").font(.caption).foregroundStyle(SpendlyTheme.teal) }
                }
                Text(detail(for: transaction)).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                if let notes = transaction.notes, !notes.isEmpty { Text(notes).font(.caption2).foregroundStyle(.secondary).lineLimit(1) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 4) {
                Text(amount(for: transaction)).font(.subheadline.bold())
                    .foregroundStyle(transaction.type == .expense ? SpendlyTheme.expense : SpendlyTheme.income)
                Text(SpendlyFormat.date(transaction.transactionDate)).font(.caption2).foregroundStyle(.secondary)
            }
            .fixedSize(horizontal: true, vertical: false)
        }
        .padding(.vertical, 6)
        .contentShape(Rectangle())
        .onTapGesture { editor = draft(for: transaction) }
    }

    private func detail(for transaction: Transaction) -> String {
        let source = store.account(id: transaction.accountID)?.name ?? "Account"
        if let destination = store.account(id: transaction.transferAccountID)?.name { return "\(source) → \(destination)" }
        return "\(source) · \(store.category(id: transaction.categoryID)?.name ?? "Transfer")"
    }

    private func amount(for transaction: Transaction) -> String {
        let sign = transaction.type == .expense ? "−" : transaction.type == .income ? "+" : ""
        return sign + SpendlyFormat.currency(transaction.amount, code: store.currency)
    }

    private func draft(for item: Transaction) -> TransactionDraft {
        TransactionDraft(
            id: item.id, accountID: item.accountID, transferAccountID: item.transferAccountID,
            categoryID: item.categoryID, type: item.type, amount: item.amount,
            description: item.description, notes: item.notes ?? "",
            transactionDate: item.transactionDate.spendlyDate ?? Date(), isRecurring: item.isRecurring
        )
    }

    private var hasFilters: Bool { typeFilter != nil || accountFilter != nil || categoryFilter != nil || dateFilter != nil }
    private func clearFilters() { typeFilter = nil; accountFilter = nil; categoryFilter = nil; dateFilter = nil }
}

private struct TransactionFiltersView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Binding var type: TransactionType?
    @Binding var accountID: String?
    @Binding var categoryID: String?
    @Binding var date: Date?
    let onClear: () -> Void
    @State private var filtersDate = false

    var body: some View {
        NavigationStack {
            Form {
                Picker("Type", selection: $type) {
                    Text("All types").tag(TransactionType?.none)
                    ForEach(TransactionType.allCases) { Text($0.title).tag(Optional($0)) }
                }
                Picker("Account", selection: $accountID) {
                    Text("All accounts").tag(String?.none)
                    ForEach(store.accounts) { Text($0.name).tag(Optional($0.id)) }
                }
                Picker("Category", selection: $categoryID) {
                    Text("All categories").tag(String?.none)
                    ForEach(store.categories) { Text($0.name).tag(Optional($0.id)) }
                }
                Toggle("Filter by date", isOn: $filtersDate)
                if filtersDate {
                    DatePicker("Date", selection: Binding(get: { date ?? Date() }, set: { date = $0 }), displayedComponents: .date)
                }
                Button("Clear filters", role: .destructive) { onClear(); filtersDate = false }
            }
            .navigationTitle("Ledger filters")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { if !filtersDate { date = nil }; dismiss() } } }
        }
        .onAppear { filtersDate = date != nil }
    }
}

struct TransactionEditor: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State var draft: TransactionDraft

    init(draft: TransactionDraft) { _draft = State(initialValue: draft) }

    private var categories: [Category] { store.categories.filter { $0.type.rawValue == draft.type.rawValue } }

    var body: some View {
        NavigationStack {
            Form {
                Section("Money movement") {
                    Picker("Type", selection: $draft.type) {
                        ForEach(TransactionType.allCases) { Label($0.title, systemImage: $0.symbol).tag($0) }
                    }
                    .onChange(of: draft.type) { _, value in
                        if value == .transfer { draft.categoryID = nil } else { draft.transferAccountID = nil }
                    }
                    Picker("Account", selection: $draft.accountID) {
                        Text("Choose account").tag("")
                        ForEach(store.accounts) { Text($0.name).tag($0.id) }
                    }
                    if draft.type == .transfer {
                        Picker("Destination", selection: $draft.transferAccountID) {
                            Text("Choose destination").tag(String?.none)
                            ForEach(store.accounts.filter { $0.id != draft.accountID }) { Text($0.name).tag(Optional($0.id)) }
                        }
                    } else {
                        Picker("Category", selection: $draft.categoryID) {
                            Text("Choose category").tag(String?.none)
                            ForEach(categories) { Text($0.name).tag(Optional($0.id)) }
                        }
                    }
                }
                Section("Details") {
                    TextField("Description", text: $draft.description)
                    TextField("Amount", value: $draft.amount, format: .number).keyboardType(.decimalPad)
                    DatePicker("Date", selection: $draft.transactionDate, displayedComponents: .date)
                    TextField("Notes (optional)", text: $draft.notes, axis: .vertical).lineLimit(2...5)
                    Toggle("Recurring cadence", isOn: $draft.isRecurring)
                }
            }
            .navigationTitle(draft.id == nil ? "Add transaction" : "Edit transaction")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { if await store.saveTransaction(draft) { dismiss() } } }.disabled(store.isLoading)
                }
            }
        }
    }
}
