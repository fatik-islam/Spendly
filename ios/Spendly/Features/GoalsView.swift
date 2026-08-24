import SwiftUI

struct GoalsView: View {
    @Environment(AppStore.self) private var store
    @State private var editor: GoalDraft?
    @State private var deleting: SavingsGoal?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 16) {
                SectionHeading(title: "Savings goals", subtitle: "Track target amounts and deadlines.")
                if store.goals.isEmpty {
                    EmptyFeatureView(symbol: "flag.checkered", title: "No savings goals yet", message: "Create a goal for an emergency fund, trip, device, or any milestone.")
                } else {
                    ForEach(store.goals) { goal in goalCard(goal) }
                }
            }.padding(16).padding(.bottom, 30)
        }
        .navigationTitle("Goals")
        .toolbar { ToolbarItem(placement: .bottomBar) { Button { editor = GoalDraft() } label: { Label("Add goal", systemImage: "plus.circle.fill") } } }
        .sheet(item: $editor) { GoalEditor(draft: $0) }
        .confirmationDialog("Delete goal?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible) {
            Button("Delete goal", role: .destructive) { if let deleting { Task { if await store.deleteGoal(deleting) { self.deleting = nil } } } }
        }
        .refreshable { await store.refreshAll() }
        .background(SpendlyBackground())
    }

    private func goalCard(_ goal: SavingsGoal) -> some View {
        let progress = goal.targetAmount > 0 ? min(100, goal.currentAmount / goal.targetAmount * 100) : 0
        return SurfaceCard {
            VStack(alignment: .leading, spacing: 15) {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(goal.name).font(.title3.bold())
                        Text(goal.deadline.map { "Deadline \(SpendlyFormat.date($0))" } ?? "No deadline").font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Menu {
                        Button { editor = GoalDraft(id: goal.id, name: goal.name, targetAmount: goal.targetAmount, currentAmount: goal.currentAmount, deadline: goal.deadline?.spendlyDate) } label: { Label("Edit", systemImage: "pencil") }
                        Button(role: .destructive) { deleting = goal } label: { Label("Delete", systemImage: "trash") }
                    } label: { Image(systemName: "ellipsis.circle") }
                }
                Text(SpendlyFormat.percent(progress)).font(.largeTitle.bold())
                ProgressView(value: progress, total: 100).tint(SpendlyTheme.cyan)
                HStack {
                    goalValue("Current", goal.currentAmount)
                    Divider()
                    goalValue("Target", goal.targetAmount)
                }
            }
        }
    }

    private func goalValue(_ title: String, _ amount: Double) -> some View {
        VStack(alignment: .leading, spacing: 4) { Text(title).font(.caption).foregroundStyle(.secondary); Text(SpendlyFormat.currency(amount, code: store.currency)).font(.headline) }.frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct GoalEditor: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State var draft: GoalDraft
    @State private var hasDeadline: Bool
    init(draft: GoalDraft) { _draft = State(initialValue: draft); _hasDeadline = State(initialValue: draft.deadline != nil) }
    var body: some View {
        NavigationStack {
            Form {
                TextField("Goal name", text: $draft.name)
                TextField("Target amount", value: $draft.targetAmount, format: .number).keyboardType(.decimalPad)
                TextField("Current amount", value: $draft.currentAmount, format: .number).keyboardType(.decimalPad)
                Toggle("Set a deadline", isOn: $hasDeadline)
                if hasDeadline { DatePicker("Deadline", selection: Binding(get: { draft.deadline ?? Date() }, set: { draft.deadline = $0 }), displayedComponents: .date) }
            }
            .navigationTitle(draft.id == nil ? "Create goal" : "Edit goal")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { if !hasDeadline { draft.deadline = nil }; Task { if await store.saveGoal(draft) { dismiss() } } } }
            }
        }
    }
}
