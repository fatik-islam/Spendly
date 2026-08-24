import SwiftUI

struct AccountsView: View {
    @Environment(AppStore.self) private var store
    @State private var editor: AccountDraft?
    @State private var transfer: TransactionDraft?
    @State private var deleting: Account?

    private let columns = [GridItem(.adaptive(minimum: 280), spacing: 14)]

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                SectionHeading(title: "Accounts", subtitle: "Manage balances and move money between your accounts.")
                MetricTile(title: "Combined balance", value: SpendlyFormat.currency(store.totalBalance, code: store.currency), note: "Across \(store.accounts.count) accounts", symbol: "wallet.bifold", tint: SpendlyTheme.teal)

                if store.accounts.isEmpty {
                    EmptyFeatureView(symbol: "wallet.bifold", title: "No accounts yet", message: "Create your first account to start tracking balances.")
                } else {
                    LazyVGrid(columns: columns, spacing: 14) {
                        ForEach(store.accounts) { account in
                            accountCard(account)
                                .contextMenu {
                                    Button { editor = draft(for: account) } label: { Label("Edit", systemImage: "pencil") }
                                    Button(role: .destructive) { deleting = account } label: { Label("Delete", systemImage: "trash") }
                                }
                        }
                    }
                }
            }
            .padding(16)
            .padding(.bottom, 30)
        }
        .navigationTitle("Accounts")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .bottomBar) {
                Button { transfer = TransactionDraft(accountID: store.accounts.first?.id ?? "", type: .transfer, description: "Account transfer") } label: { Label("Transfer", systemImage: "arrow.left.arrow.right") }
                    .disabled(store.accounts.count < 2)
                Spacer()
                Button { editor = AccountDraft(currency: store.currency) } label: { Label("Add account", systemImage: "plus.circle.fill") }
            }
        }
        .sheet(item: $editor) { AccountEditor(draft: $0) }
        .sheet(item: $transfer) { TransactionEditor(draft: $0) }
        .confirmationDialog("Delete account?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible) {
            Button("Delete account", role: .destructive) { if let deleting { Task { if await store.deleteAccount(deleting) { self.deleting = nil } } } }
            Button("Cancel", role: .cancel) { deleting = nil }
        } message: { Text("Accounts with transaction or recurring history cannot be deleted.") }
        .refreshable { await store.refreshAll() }
        .background(SpendlyBackground())
    }

    private func accountCard(_ account: Account) -> some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Label(account.type.title, systemImage: account.type.symbol)
                        .font(.caption.weight(.semibold)).foregroundStyle(SpendlyTheme.teal)
                    Spacer()
                    Menu {
                        Button { editor = draft(for: account) } label: { Label("Edit account", systemImage: "pencil") }
                        Button(role: .destructive) { deleting = account } label: { Label("Delete account", systemImage: "trash") }
                    } label: { Image(systemName: "ellipsis.circle") }
                }
                Text(account.name).font(.title2.bold())
                VStack(alignment: .leading, spacing: 4) {
                    Text("Current balance").font(.caption).foregroundStyle(.secondary)
                    Text(SpendlyFormat.currency(account.balance, code: store.currency)).font(.title.bold()).minimumScaleFactor(0.7).lineLimit(1)
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 18))
                let activity = store.transactions.filter { $0.accountID == account.id || $0.transferAccountID == account.id }.count
                Text("\(activity) ledger event\(activity == 1 ? "" : "s")").font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    private func draft(for account: Account) -> AccountDraft {
        AccountDraft(id: account.id, name: account.name, type: account.type, balance: account.balance, currency: account.currency)
    }
}

private struct AccountEditor: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State var draft: AccountDraft
    init(draft: AccountDraft) { _draft = State(initialValue: draft) }

    var body: some View {
        NavigationStack {
            Form {
                Section("Account") {
                    TextField("Name", text: $draft.name)
                    Picker("Type", selection: $draft.type) { ForEach(AccountType.allCases) { Text($0.title).tag($0) } }
                    TextField("Current balance", value: $draft.balance, format: .number).keyboardType(.decimalPad)
                    Picker("Currency", selection: $draft.currency) { ForEach(CurrencyCode.allCases) { Text($0.rawValue).tag($0) } }
                }
            }
            .navigationTitle(draft.id == nil ? "Add account" : "Edit account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { Task { if await store.saveAccount(draft) { dismiss() } } } }
            }
        }
    }
}
