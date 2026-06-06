"use client"

import Link from "next/link"
import { ArrowRightLeft, PiggyBank, TrendingDown, TrendingUp, Wallet } from "lucide-react"
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts"

import { CategoryIcon } from "@/components/spendly/category-icon"
import { DemoWorkspaceButton } from "@/components/spendly/demo-workspace-button"
import { MetricCard } from "@/components/spendly/metric-card"
import { PageHeader } from "@/components/spendly/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { summarizeBudgetState } from "@/lib/finance-utils"
import { formatCurrency, formatDate } from "@/lib/format"
import { type CurrencyCode, type DashboardSnapshot } from "@/lib/types"
import { toCurrencyNumber } from "@/lib/utils"

export function DashboardView({
  snapshot
}: {
  snapshot: DashboardSnapshot & { currency: CurrencyCode }
}) {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Balances, cash flow, budgets, goals, and upcoming bills."
      />

      {snapshot.canLoadDemoData ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-2">
              <h2 className="font-display text-2xl font-semibold tracking-tight">Load demo data.</h2>
              <p className="text-sm leading-6 text-muted-foreground">Seed the workspace or start with your own first entry.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <DemoWorkspaceButton />
              <Button asChild variant="ghost">
                <Link href="/transactions">Add first transaction</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total balance"
          value={snapshot.totalBalance}
          currency={snapshot.currency}
          note="Across all accounts"
          icon={Wallet}
          tone="positive"
        />
        <MetricCard
          title="Monthly income"
          value={snapshot.monthlyIncome}
          currency={snapshot.currency}
          note="Current month inflow"
          icon={TrendingUp}
          tone="positive"
        />
        <MetricCard
          title="Monthly expenses"
          value={snapshot.monthlyExpenses}
          currency={snapshot.currency}
          note="Current month outflow"
          icon={TrendingDown}
          tone="negative"
        />
        <MetricCard
          title="Net savings"
          value={snapshot.netSavings}
          currency={snapshot.currency}
          note={`${Math.round(snapshot.savingsRate)}% savings rate`}
          icon={PiggyBank}
          tone={snapshot.netSavings >= 0 ? "positive" : "negative"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Spending trend</CardTitle>
            <CardDescription className="hidden sm:block">Income, expenses, and net savings across the last six months.</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px] px-3 pb-4 sm:h-[360px] sm:px-6 sm:pb-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={snapshot.trend}>
                <defs>
                  <linearGradient id="income" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="expense" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-4))" stopOpacity={0.65} />
                    <stop offset="95%" stopColor="hsl(var(--chart-4))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis axisLine={false} dataKey="month" tickLine={false} tickMargin={10} stroke="hsl(var(--muted-foreground))" />
                <YAxis axisLine={false} tickLine={false} tickMargin={10} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    borderRadius: 16,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))"
                  }}
                />
                <Area type="monotone" dataKey="income" stroke="hsl(var(--chart-1))" strokeWidth={3} fill="url(#income)" />
                <Area type="monotone" dataKey="expenses" stroke="hsl(var(--chart-4))" strokeWidth={3} fill="url(#expense)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category breakdown</CardTitle>
            <CardDescription className="hidden sm:block">Current month expense mix by category.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={snapshot.categoryBreakdown} innerRadius={56} outerRadius={88} dataKey="value" paddingAngle={4}>
                    {snapshot.categoryBreakdown.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value, snapshot.currency as never)}
                    contentStyle={{
                      borderRadius: 16,
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))"
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {snapshot.categoryBreakdown.length ? (
                snapshot.categoryBreakdown.slice(0, 5).map((item) => (
                  <div key={item.name} className="flex flex-col gap-2 rounded-2xl bg-secondary/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="size-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{formatCurrency(item.value, snapshot.currency as never)}</span>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  Add some expenses to unlock the category chart.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent transactions</CardTitle>
            <CardDescription className="hidden sm:block">The latest money movement across your accounts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.recentTransactions.length ? (
              snapshot.recentTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="rounded-2xl p-2"
                      style={{
                        backgroundColor: `${transaction.category?.color ?? "#14B8A6"}20`,
                        color: transaction.category?.color ?? "#14B8A6"
                      }}
                    >
                      {transaction.type === "transfer" ? (
                        <ArrowRightLeft className="size-4" />
                      ) : (
                        <CategoryIcon icon={transaction.category?.icon} className="size-4" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{transaction.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {transaction.account?.name}
                        {transaction.transfer_account ? ` → ${transaction.transfer_account.name}` : ""}
                        {" · "}
                        {formatDate(transaction.transaction_date, "MMM d")}
                      </p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className={transaction.type === "expense" ? "font-semibold text-rose-500" : "font-semibold text-emerald-500"}>
                      {transaction.type === "expense" ? "-" : "+"}
                      {formatCurrency(toCurrencyNumber(transaction.amount), snapshot.currency as never)}
                    </p>
                    <p className="text-sm text-muted-foreground">{transaction.category?.name ?? "Transfer"}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                No transactions yet. Add your first income or expense from the transactions page.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Budgets & goals</CardTitle>
            <CardDescription className="hidden sm:block">Budgets and savings progress.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Budgets</h3>
              {snapshot.budgets.length ? (
                snapshot.budgets.map((budget) => (
                  <div key={budget.id} className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <span className="size-3 rounded-full" style={{ backgroundColor: budget.color }} />
                        <span className="font-medium">{budget.name}</span>
                      </div>
                      <Badge variant={budget.progress >= 100 ? "destructive" : "default"}>{summarizeBudgetState(budget.progress)}</Badge>
                    </div>
                    <Progress value={budget.progress} />
                    <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                      <span>{formatCurrency(budget.spent, snapshot.currency as never)} spent</span>
                      <span>{formatCurrency(budget.amount, snapshot.currency as never)} limit</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                  Set monthly category budgets to unlock overspending warnings.
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Savings goals</h3>
              {snapshot.goals.length ? (
                snapshot.goals.slice(0, 3).map((goal) => (
                  <div key={goal.id} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-medium">{goal.name}</p>
                      <p className="text-sm text-muted-foreground">{Math.round(goal.progress)}%</p>
                    </div>
                    <div className="mt-3">
                      <Progress value={goal.progress} />
                    </div>
                    <div className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                      <span>{formatCurrency(goal.currentAmount, snapshot.currency as never)}</span>
                      <span>{formatCurrency(goal.targetAmount, snapshot.currency as never)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                  Add a savings goal to turn progress into a daily motivator.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recurring radar</CardTitle>
            <CardDescription className="hidden sm:block">Upcoming recurring payments and your current health score.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-[28px] bg-gradient-to-br from-primary/15 via-cyan-400/10 to-transparent p-5">
              <p className="text-sm text-muted-foreground">Financial health</p>
              <p className="mt-2 font-display text-4xl font-semibold sm:text-5xl">{snapshot.financialHealthScore}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Balance, savings rate, and budget pressure.
              </p>
            </div>
            <div className="space-y-3">
              {snapshot.upcomingRecurring.length ? (
                snapshot.upcomingRecurring.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-medium">{item.description}</p>
                      <Badge variant="outline">{item.frequency}</Badge>
                    </div>
                    <div className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                      <span>{item.account?.name ?? "Account"}</span>
                      <span>{formatCurrency(toCurrencyNumber(item.amount), snapshot.currency as never)}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">Due {formatDate(item.next_due_date, "MMM d")}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                  No recurring reminders yet. Add subscriptions, bills, or income cycles from the recurring page.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
