import SwiftUI

struct MainTabView: View {
    enum Tab: Hashable { case overview, ledger, accounts, budgets, more }
    @State private var selectedTab: Tab = .overview

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack { DashboardView().spendlyToolbar() }
                .tabItem { Label("Overview", systemImage: "square.grid.2x2") }
                .tag(Tab.overview)

            NavigationStack { TransactionsView().spendlyToolbar() }
                .tabItem { Label("Ledger", systemImage: "list.bullet.rectangle") }
                .tag(Tab.ledger)

            NavigationStack { AccountsView().spendlyToolbar() }
                .tabItem { Label("Accounts", systemImage: "wallet.bifold") }
                .tag(Tab.accounts)

            NavigationStack { BudgetsView().spendlyToolbar() }
                .tabItem { Label("Budgets", systemImage: "chart.pie") }
                .tag(Tab.budgets)

            NavigationStack { MoreView().spendlyToolbar() }
                .tabItem { Label("More", systemImage: "ellipsis") }
                .tag(Tab.more)
        }
    }
}

private struct SpendlyToolbarModifier: ViewModifier {
    @Environment(AppStore.self) private var store
    @State private var showsReminders = false

    func body(content: Content) -> some View {
        content
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { BrandView(compact: true) }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showsReminders = true } label: {
                        Image(systemName: store.unreadReminders.isEmpty ? "bell" : "bell.badge.fill")
                            .symbolRenderingMode(.palette)
                            .foregroundStyle(SpendlyTheme.expense, .primary)
                    }
                    .accessibilityLabel("Reminder center, \(store.unreadReminders.count) unread")
                }
            }
            .sheet(isPresented: $showsReminders) { ReminderCenterView() }
    }
}

extension View {
    func spendlyToolbar() -> some View { modifier(SpendlyToolbarModifier()) }
}

struct MoreView: View {
    var body: some View {
        List {
            Section("Plan and track") {
                NavigationLink { GoalsView() } label: { Label("Savings goals", systemImage: "flag.checkered") }
                NavigationLink { RecurringView() } label: { Label("Recurring", systemImage: "repeat") }
                NavigationLink { InsightsView() } label: { Label("Insights", systemImage: "chart.bar.xaxis") }
            }
            Section("Workspace") {
                NavigationLink { SettingsView() } label: { Label("Settings", systemImage: "gearshape") }
            }
        }
        .navigationTitle("More")
        .spendlyPage()
    }
}

struct ReminderCenterView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(spacing: 12) {
                        reminderMetric("Unread", store.unreadReminders.count, .primary)
                        reminderMetric("Upcoming", store.unreadReminders.filter { $0.kind == "upcoming" }.count, SpendlyTheme.teal)
                        reminderMetric("Overdue", store.unreadReminders.filter { $0.kind == "overdue" }.count, SpendlyTheme.expense)
                    }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                }

                Section("Active reminders") {
                    if store.reminders.isEmpty {
                        ContentUnavailableView("No active reminders", systemImage: "bell.slash", description: Text("Upcoming recurring items will appear here."))
                    } else {
                        ForEach(store.reminders) { reminder in
                            VStack(alignment: .leading, spacing: 9) {
                                HStack {
                                    Text(reminder.title).font(.headline)
                                    Spacer()
                                    Text(reminder.kind.capitalized)
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(reminder.kind == "overdue" ? SpendlyTheme.expense : SpendlyTheme.teal)
                                }
                                Text(reminder.body).font(.subheadline).foregroundStyle(.secondary)
                                Text("Due \(SpendlyFormat.date(reminder.dueDate))").font(.caption).foregroundStyle(.secondary)
                                HStack {
                                    if reminder.readAt == nil {
                                        Button("Mark read") { Task { _ = await store.markReminderRead(reminder) } }
                                            .buttonStyle(.bordered)
                                    }
                                    Button("Dismiss", role: .destructive) { Task { _ = await store.dismissReminder(reminder) } }
                                        .buttonStyle(.bordered)
                                }
                            }
                            .padding(.vertical, 7)
                        }
                    }
                }
            }
            .navigationTitle("Reminder center")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .spendlyPage()
        }
    }

    private func reminderMetric(_ title: String, _ value: Int, _ color: Color) -> some View {
        VStack(spacing: 4) {
            Text("\(value)").font(.title.bold()).foregroundStyle(color)
            Text(title).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}
