import SwiftUI

struct RecurringView: View {
    @Environment(AppStore.self) private var store
    @State private var editor: RecurringDraft?
    @State private var deleting: RecurringTransaction?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                SectionHeading(title: "Recurring", subtitle: "Stay ahead of bills and repeating income.")
                summary
                if store.recurringTransactions.isEmpty {
                    EmptyFeatureView(symbol: "repeat", title: "No recurring items yet", message: "Create reminders for subscriptions, bills, and repeating income.")
                } else {
                    ForEach(store.recurringTransactions) { item in recurringCard(item) }
                }
            }
            .padding(16).padding(.bottom, 30)
        }
        .navigationTitle("Recurring")
        .toolbar { ToolbarItem(placement: .bottomBar) { Button { editor = RecurringDraft(accountID: store.accounts.first?.id ?? "") } label: { Label("Add item", systemImage: "plus.circle.fill") } } }
        .sheet(item: $editor) { RecurringEditor(draft: $0) }
        .confirmationDialog("Delete recurring item?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible) {
            Button("Delete item", role: .destructive) { if let deleting { Task { if await store.deleteRecurring(deleting) { self.deleting = nil } } } }
        }
        .refreshable { await store.refreshAll() }
        .background(SpendlyBackground())
    }

    private var summary: some View {
        HStack(spacing: 10) {
            summaryTile("Unread", "\(store.unreadReminders.count)", "bell.badge", SpendlyTheme.expense)
            summaryTile("Lead time", "\(store.profile?.reminderDaysBefore ?? 3)d", "clock", SpendlyTheme.teal)
            summaryTile("Email", store.profile?.reminderEmailEnabled == true ? "On" : "Off", "envelope", SpendlyTheme.cyan)
        }
    }

    private func summaryTile(_ title: String, _ value: String, _ symbol: String, _ tint: Color) -> some View {
        VStack(spacing: 7) {
            Image(systemName: symbol).foregroundStyle(tint)
            Text(value).font(.title3.bold())
            Text(title).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 15)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 19, style: .continuous))
    }

    private func recurringCard(_ item: RecurringTransaction) -> some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 15) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 5) {
                        HStack { Text(item.description).font(.title3.bold()); Text(item.active ? "Active" : "Paused").font(.caption.weight(.semibold)).foregroundStyle(item.active ? SpendlyTheme.teal : .secondary) }
                        Text("\(store.account(id: item.accountID)?.name ?? "Account") · \(item.frequency.title)").font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Menu {
                        Button { editor = draft(for: item) } label: { Label("Edit", systemImage: "pencil") }
                        Button(role: .destructive) { deleting = item } label: { Label("Delete", systemImage: "trash") }
                    } label: { Image(systemName: "ellipsis.circle") }
                }
                Text((item.type == .expense ? "−" : "+") + SpendlyFormat.currency(item.amount, code: store.currency))
                    .font(.title.bold()).foregroundStyle(item.type == .expense ? SpendlyTheme.expense : SpendlyTheme.income)
                Text("Due \(SpendlyFormat.date(item.nextDueDate)) · \(store.category(id: item.categoryID)?.name ?? "No category")")
                    .font(.subheadline).foregroundStyle(.secondary)
                Button { Task { _ = await store.toggleRecurring(item) } } label: {
                    Label(item.active ? "Pause reminders" : "Resume reminders", systemImage: item.active ? "pause.circle" : "play.circle")
                }
                .buttonStyle(.bordered)
            }
        }
    }

    private func draft(for item: RecurringTransaction) -> RecurringDraft {
        RecurringDraft(id: item.id, accountID: item.accountID, categoryID: item.categoryID, type: item.type, amount: item.amount, description: item.description, frequency: item.frequency, nextDueDate: item.nextDueDate.spendlyDate ?? Date(), active: item.active)
    }
}

private struct RecurringEditor: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State var draft: RecurringDraft
    init(draft: RecurringDraft) { _draft = State(initialValue: draft) }
    private var categories: [Category] { store.categories.filter { $0.type.rawValue == draft.type.rawValue } }
    var body: some View {
        NavigationStack {
            Form {
                Section("Recurring item") {
                    TextField("Description", text: $draft.description)
                    Picker("Type", selection: $draft.type) {
                        Text("Expense").tag(TransactionType.expense)
                        Text("Income").tag(TransactionType.income)
                    }
                    .onChange(of: draft.type) { _, _ in draft.categoryID = nil }
                    Picker("Frequency", selection: $draft.frequency) { ForEach(RecurringFrequency.allCases) { Text($0.title).tag($0) } }
                    Picker("Account", selection: $draft.accountID) {
                        Text("Choose account").tag("")
                        ForEach(store.accounts) { Text($0.name).tag($0.id) }
                    }
                    Picker("Category", selection: $draft.categoryID) {
                        Text("Choose category").tag(String?.none)
                        ForEach(categories) { Text($0.name).tag(Optional($0.id)) }
                    }
                    TextField("Amount", value: $draft.amount, format: .number).keyboardType(.decimalPad)
                    DatePicker("Next due date", selection: $draft.nextDueDate, displayedComponents: .date)
                    Toggle("Keep active", isOn: $draft.active)
                }
            }
            .navigationTitle(draft.id == nil ? "Create recurring item" : "Edit recurring item")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { Task { if await store.saveRecurring(draft) { dismiss() } } } }
            }
        }
    }
}
