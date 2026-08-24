import Charts
import SwiftUI

struct InsightsView: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                SectionHeading(title: "Insights", subtitle: "Compare cash flow, category weight, and savings health.")
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 155), spacing: 12)], spacing: 12) {
                    MetricTile(title: "Health score", value: "\(store.financialHealthScore)", note: "Balance, budgets, savings", symbol: "heart.text.square", tint: SpendlyTheme.teal)
                    MetricTile(title: "Savings rate", value: SpendlyFormat.percent(store.savingsRate), note: "Share of this month’s income", symbol: "percent", tint: SpendlyTheme.income)
                    MetricTile(title: "Income vs expense", value: SpendlyFormat.currency(store.netSavings, code: store.currency), note: "This month’s spread", symbol: "arrow.up.arrow.down", tint: store.netSavings >= 0 ? SpendlyTheme.income : SpendlyTheme.expense)
                    MetricTile(title: "Top spending", value: store.categorySpending.first?.name ?? "No data", note: store.categorySpending.first.map { SpendlyFormat.currency($0.amount, code: store.currency) } ?? "Add expenses", symbol: "scope", tint: SpendlyTheme.amber)
                }
                comparisonChart
                topCategories
            }
            .padding(16).padding(.bottom, 30)
        }
        .navigationTitle("Insights")
        .refreshable { await store.refreshAll() }
        .background(SpendlyBackground())
    }

    private var comparisonChart: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 16) {
                SectionHeading(title: "Monthly comparison", subtitle: "Income versus expenses for the last twelve months.")
                Chart(store.twelveMonthCashFlow) { item in
                    BarMark(x: .value("Month", item.label), y: .value("Income", item.income))
                        .foregroundStyle(SpendlyTheme.teal)
                        .position(by: .value("Kind", "Income"))
                    BarMark(x: .value("Month", item.label), y: .value("Expense", item.expense))
                        .foregroundStyle(SpendlyTheme.expense)
                        .position(by: .value("Kind", "Expense"))
                }
                .frame(height: 260)
                .chartXAxis { AxisMarks(values: .automatic(desiredCount: 6)) }
            }
        }
    }

    private var topCategories: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 14) {
                SectionHeading(title: "Top spending categories", subtitle: "Your largest categories across the current month.")
                if store.categorySpending.isEmpty {
                    Text("Add expenses to surface category leaders.").font(.subheadline).foregroundStyle(.secondary)
                } else {
                    ForEach(Array(store.categorySpending.prefix(5).enumerated()), id: \.element.id) { index, category in
                        HStack(spacing: 12) {
                            Text("\(index + 1)").font(.headline).frame(width: 36, height: 36)
                                .background(SpendlyTheme.color(hex: category.color), in: Circle())
                                .foregroundStyle(.white)
                            Text(category.name).font(.headline)
                            Spacer()
                            Text(SpendlyFormat.currency(category.amount, code: store.currency)).font(.subheadline).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }
}
