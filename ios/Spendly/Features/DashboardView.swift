import Charts
import SwiftUI

struct DashboardView: View {
    @Environment(AppStore.self) private var store
    @State private var confirmsDemo = false

    private let metricColumns = [GridItem(.adaptive(minimum: 155), spacing: 12)]

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 20) {
                SectionHeading(title: greeting, subtitle: "Balances, cash flow, budgets, goals, and upcoming bills.")

                if store.canLoadDemoData { demoBanner }

                LazyVGrid(columns: metricColumns, spacing: 12) {
                    MetricTile(title: "Total balance", value: money(store.totalBalance), note: "Across all accounts", symbol: "wallet.bifold", tint: SpendlyTheme.teal)
                    MetricTile(title: "Monthly income", value: money(store.monthlyIncome), note: "Current month inflow", symbol: "arrow.down.left", tint: SpendlyTheme.income)
                    MetricTile(title: "Monthly expenses", value: money(store.monthlyExpenses), note: "Current month outflow", symbol: "arrow.up.right", tint: SpendlyTheme.expense)
                    MetricTile(title: "Net savings", value: money(store.netSavings), note: "\(SpendlyFormat.percent(store.savingsRate)) savings rate", symbol: "banknote", tint: store.netSavings >= 0 ? SpendlyTheme.income : SpendlyTheme.expense)
                }

                spendingTrend
                categoryBreakdown
                recentTransactions
                budgetsAndGoals
                upcomingBills
            }
            .padding(16)
            .padding(.bottom, 24)
        }
        .navigationTitle("Overview")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await store.refreshAll() }
        .background(SpendlyBackground())
        .confirmationDialog("Load demo workspace?", isPresented: $confirmsDemo, titleVisibility: .visible) {
            Button("Load demo workspace") { Task { _ = await store.loadDemoWorkspace() } }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("This adds sample transactions, budgets, goals, and recurring items. It only works while the workspace is empty.")
        }
    }

    private var demoBanner: some View {
        GlassAction(tint: SpendlyTheme.teal, interactive: false) {
            VStack(alignment: .leading, spacing: 12) {
                Label("Explore a complete workspace", systemImage: "sparkles")
                    .font(.headline)
                Text("Load Spendly’s safe demo dataset or create your first ledger entry.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Button("Load demo workspace") { confirmsDemo = true }
                    .buttonStyle(.borderedProminent)
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var spendingTrend: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 16) {
                SectionHeading(title: "Spending trend", subtitle: "Income and expenses across the last six months.")
                Chart(store.sixMonthCashFlow) { item in
                    AreaMark(x: .value("Month", item.label), y: .value("Income", item.income))
                        .foregroundStyle(SpendlyTheme.teal.opacity(0.28))
                    LineMark(x: .value("Month", item.label), y: .value("Income", item.income))
                        .foregroundStyle(SpendlyTheme.teal)
                        .lineStyle(.init(lineWidth: 3))
                    LineMark(x: .value("Month", item.label), y: .value("Expenses", item.expense))
                        .foregroundStyle(SpendlyTheme.expense)
                        .lineStyle(.init(lineWidth: 2))
                }
                .frame(height: 220)
                .chartYAxis { AxisMarks(position: .leading) { value in AxisGridLine(); AxisValueLabel { if let number = value.as(Double.self) { Text(number, format: .number.notation(.compactName)) } } } }
            }
        }
    }

    private var categoryBreakdown: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 16) {
                SectionHeading(title: "Category breakdown", subtitle: "Current month expense mix.")
                if store.categorySpending.isEmpty {
                    Text("Add expenses to unlock this view.").font(.subheadline).foregroundStyle(.secondary)
                } else {
                    Chart(store.categorySpending) { item in
                        SectorMark(angle: .value("Amount", item.amount), innerRadius: .ratio(0.6), angularInset: 3)
                            .cornerRadius(5)
                            .foregroundStyle(SpendlyTheme.color(hex: item.color))
                    }
                    .frame(height: 190)
                    ForEach(store.categorySpending.prefix(5)) { item in
                        HStack {
                            Circle().fill(SpendlyTheme.color(hex: item.color)).frame(width: 10, height: 10)
                            Text(item.name).font(.subheadline.weight(.medium))
                            Spacer()
                            Text(money(item.amount)).font(.subheadline).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }

    private var recentTransactions: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeading(title: "Recent transactions", subtitle: "The latest movement across your accounts.")
            if store.transactions.isEmpty {
                EmptyFeatureView(symbol: "list.bullet.rectangle", title: "No transactions yet", message: "Add income, expenses, or transfers from the Ledger tab.")
            } else {
                ForEach(store.transactions.prefix(6)) { transaction in TransactionRow(transaction: transaction) }
            }
        }
    }

    private var budgetsAndGoals: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 16) {
                SectionHeading(title: "Budgets & goals", subtitle: "Current progress at a glance.")
                ForEach(store.currentBudgetProgress.prefix(4)) { item in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(item.category?.name ?? "Budget").font(.subheadline.weight(.semibold))
                            Spacer()
                            Text(SpendlyFormat.percent(item.progress)).font(.caption.weight(.bold)).foregroundStyle(item.progress >= 100 ? SpendlyTheme.expense : .secondary)
                        }
                        ProgressView(value: min(100, item.progress), total: 100).tint(item.progress >= 100 ? SpendlyTheme.expense : SpendlyTheme.teal)
                    }
                }
                if !store.goals.isEmpty {
                    Divider()
                    ForEach(store.goals.prefix(3)) { goal in
                        let progress = goal.targetAmount > 0 ? min(100, goal.currentAmount / goal.targetAmount * 100) : 0
                        VStack(alignment: .leading, spacing: 8) {
                            HStack { Text(goal.name).font(.subheadline.weight(.semibold)); Spacer(); Text(SpendlyFormat.percent(progress)).font(.caption) }
                            ProgressView(value: progress, total: 100).tint(SpendlyTheme.cyan)
                        }
                    }
                }
                if store.currentBudgetProgress.isEmpty && store.goals.isEmpty {
                    Text("Create a budget or savings goal to track progress here.").font(.subheadline).foregroundStyle(.secondary)
                }
            }
        }
    }

    private var upcomingBills: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeading(title: "Upcoming", subtitle: "Active recurring items due within 30 days.")
            let upcoming = store.recurringTransactions.filter { item in
                guard item.active, let due = item.nextDueDate.spendlyDate else { return false }
                return due <= Calendar.current.date(byAdding: .day, value: 30, to: Date()) ?? Date()
            }
            if upcoming.isEmpty {
                EmptyFeatureView(symbol: "calendar.badge.clock", title: "Nothing due soon", message: "Recurring bills and income will appear here.")
            } else {
                ForEach(upcoming.prefix(5)) { item in
                    SurfaceCard {
                        HStack(spacing: 12) {
                            Image(systemName: "repeat").foregroundStyle(SpendlyTheme.teal).padding(10).background(SpendlyTheme.teal.opacity(0.12), in: RoundedRectangle(cornerRadius: 14))
                            VStack(alignment: .leading, spacing: 3) {
                                Text(item.description).font(.headline)
                                Text("Due \(SpendlyFormat.date(item.nextDueDate)) · \(item.frequency.title)").font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text((item.type == .expense ? "−" : "+") + money(item.amount))
                                .font(.subheadline.bold())
                                .foregroundStyle(item.type == .expense ? SpendlyTheme.expense : SpendlyTheme.income)
                        }
                    }
                }
            }
        }
    }

    private var greeting: String {
        let name = store.profile?.fullName?.split(separator: " ").first.map(String.init)
        return name.map { "Welcome, \($0)" } ?? "Dashboard"
    }

    private func money(_ value: Double) -> String { SpendlyFormat.currency(value, code: store.currency) }
}

struct TransactionRow: View {
    @Environment(AppStore.self) private var store
    let transaction: Transaction

    var body: some View {
        SurfaceCard {
            HStack(spacing: 12) {
                let category = store.category(id: transaction.categoryID)
                Image(systemName: transaction.type == .transfer ? "arrow.left.arrow.right" : CategorySymbol.systemName(for: category?.icon))
                    .foregroundStyle(SpendlyTheme.color(hex: category?.color ?? "#14B8A6"))
                    .frame(width: 40, height: 40)
                    .background(SpendlyTheme.color(hex: category?.color ?? "#14B8A6").opacity(0.12), in: RoundedRectangle(cornerRadius: 14))
                VStack(alignment: .leading, spacing: 3) {
                    Text(transaction.description).font(.headline).lineLimit(1)
                    Text("\(store.account(id: transaction.accountID)?.name ?? "Account") · \(SpendlyFormat.date(transaction.transactionDate))")
                        .font(.caption).foregroundStyle(.secondary).lineLimit(1)
                }
                Spacer(minLength: 6)
                Text(amountText)
                    .font(.subheadline.bold())
                    .foregroundStyle(transaction.type == .expense ? SpendlyTheme.expense : SpendlyTheme.income)
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
            }
        }
    }

    private var amountText: String {
        let sign = transaction.type == .expense ? "−" : transaction.type == .income ? "+" : ""
        return sign + SpendlyFormat.currency(transaction.amount, code: store.currency)
    }
}
