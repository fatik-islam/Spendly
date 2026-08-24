import SwiftUI

struct BudgetsView: View {
    @Environment(AppStore.self) private var store
    @State private var editor: BudgetDraft?
    @State private var deleting: Budget?
    private let columns = [GridItem(.adaptive(minimum: 280), spacing: 14)]

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                SectionHeading(title: "Budgets", subtitle: "Set monthly limits and watch category pace.")
                if store.budgets.isEmpty {
                    EmptyFeatureView(symbol: "chart.pie", title: "No budgets yet", message: "Create category budgets to watch spending pace.")
                } else {
                    LazyVGrid(columns: columns, spacing: 14) {
                        ForEach(allProgress) { item in budgetCard(item) }
                    }
                }
            }
            .padding(16).padding(.bottom, 28)
        }
        .navigationTitle("Budgets")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .bottomBar) { Button { editor = BudgetDraft() } label: { Label("Add budget", systemImage: "plus.circle.fill") } } }
        .sheet(item: $editor) { BudgetEditor(draft: $0) }
        .confirmationDialog("Delete budget?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible) {
            Button("Delete budget", role: .destructive) { if let deleting { Task { if await store.deleteBudget(deleting) { self.deleting = nil } } } }
        }
        .refreshable { await store.refreshAll() }
        .background(SpendlyBackground())
    }

    private var allProgress: [BudgetProgress] {
        store.budgets.map { budget in
            let spent = store.transactions.filter { transaction in
                guard transaction.type == .expense, transaction.categoryID == budget.categoryID, let date = transaction.transactionDate.spendlyDate else { return false }
                let parts = Calendar.current.dateComponents([.month, .year], from: date)
                return parts.month == budget.month && parts.year == budget.year
            }.reduce(0) { $0 + $1.amount }
            return BudgetProgress(id: budget.id, budget: budget, category: store.category(id: budget.categoryID), spent: spent, progress: budget.amount > 0 ? min(130, spent / budget.amount * 100) : 0)
        }
    }

    private func budgetCard(_ item: BudgetProgress) -> some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Circle().fill(SpendlyTheme.color(hex: item.category?.color ?? "#14B8A6")).frame(width: 11, height: 11)
                    Text(item.category?.name ?? "Category").font(.title3.bold())
                    Spacer()
                    Menu {
                        Button { editor = BudgetDraft(id: item.budget.id, categoryID: item.budget.categoryID, amount: item.budget.amount, month: item.budget.month, year: item.budget.year) } label: { Label("Edit", systemImage: "pencil") }
                        Button(role: .destructive) { deleting = item.budget } label: { Label("Delete", systemImage: "trash") }
                    } label: { Image(systemName: "ellipsis.circle") }
                }
                Text("\(item.budget.month)/\(item.budget.year)").font(.caption).foregroundStyle(.secondary)
                Text(SpendlyFormat.percent(item.progress)).font(.largeTitle.bold()).foregroundStyle(item.progress >= 100 ? SpendlyTheme.expense : .primary)
                ProgressView(value: min(100, item.progress), total: 100).tint(item.progress >= 100 ? SpendlyTheme.expense : SpendlyTheme.teal)
                HStack {
                    valuePair("Spent", item.spent)
                    Divider()
                    valuePair("Budget", item.budget.amount)
                }
                if item.progress >= 80 {
                    Label(item.progress >= 100 ? "Budget exceeded" : "Above the 80% warning threshold", systemImage: "exclamationmark.triangle.fill")
                        .font(.caption.weight(.semibold)).foregroundStyle(item.progress >= 100 ? SpendlyTheme.expense : SpendlyTheme.amber)
                }
            }
        }
    }

    private func valuePair(_ title: String, _ value: Double) -> some View {
        VStack(alignment: .leading, spacing: 3) { Text(title).font(.caption).foregroundStyle(.secondary); Text(SpendlyFormat.currency(value, code: store.currency)).font(.subheadline.bold()) }.frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct BudgetEditor: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State var draft: BudgetDraft
    init(draft: BudgetDraft) { _draft = State(initialValue: draft) }
    var body: some View {
        NavigationStack {
            Form {
                Picker("Category", selection: $draft.categoryID) {
                    Text("Choose category").tag("")
                    ForEach(store.categories.filter { $0.type == .expense }) { Text($0.name).tag($0.id) }
                }
                TextField("Amount", value: $draft.amount, format: .number).keyboardType(.decimalPad)
                Picker("Month", selection: $draft.month) { ForEach(1...12, id: \.self) { Text(DateFormatter().monthSymbols[$0 - 1]).tag($0) } }
                Stepper("Year: \(draft.year)", value: $draft.year, in: 2024...2100)
            }
            .navigationTitle(draft.id == nil ? "Create budget" : "Edit budget")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { Task { if await store.saveBudget(draft) { dismiss() } } } }
            }
        }
    }
}
