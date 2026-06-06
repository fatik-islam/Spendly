"use client"

import { TrendingUp } from "lucide-react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { PageHeader } from "@/components/spendly/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/format"
import { type CurrencyCode } from "@/lib/types"

export function InsightsView({
  currency,
  snapshot,
  monthlyComparison,
  topCategories
}: {
  currency: CurrencyCode
  snapshot: {
    financialHealthScore: number
    savingsRate: number
    monthlyIncome: number
    monthlyExpenses: number
    netSavings: number
  }
  monthlyComparison: Array<{ month: string; income: number; expense: number }>
  topCategories: Array<{ id: string; name: string; color: string; spent: number }>
}) {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Insights"
        description="Compare cash flow, category weight, and savings health."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Financial health score</p>
            <p className="mt-3 font-display text-4xl font-semibold sm:text-5xl">{snapshot.financialHealthScore}</p>
            <p className="mt-2 text-sm text-muted-foreground">Balance, budgets, and savings rate.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Savings rate</p>
            <p className="mt-3 font-display text-4xl font-semibold sm:text-5xl">{Math.round(snapshot.savingsRate)}%</p>
            <p className="mt-2 text-sm text-muted-foreground">Share of this month&apos;s income.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Income vs expense</p>
            <p className="mt-3 font-display text-3xl font-semibold">
              {formatCurrency(snapshot.monthlyIncome - snapshot.monthlyExpenses, currency as never)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">This month&apos;s spread between inflow and outflow.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Top spending focus</p>
            <p className="mt-3 font-display text-3xl font-semibold">{topCategories[0]?.name ?? "No data yet"}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {topCategories[0] ? formatCurrency(topCategories[0].spent, currency as never) : "Add expenses to surface category leaders."}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Monthly comparison</CardTitle>
            <CardDescription className="hidden sm:block">Income versus expense for the last twelve months.</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px] px-3 pb-4 sm:h-[360px] sm:px-6 sm:pb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyComparison}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis axisLine={false} dataKey="month" tickLine={false} tickMargin={10} stroke="hsl(var(--muted-foreground))" />
                <YAxis axisLine={false} tickLine={false} tickMargin={10} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    borderRadius: 16,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))"
                  }}
                />
                <Bar dataKey="income" radius={[10, 10, 0, 0]} fill="hsl(var(--chart-1))" />
                <Bar dataKey="expense" radius={[10, 10, 0, 0]} fill="hsl(var(--chart-4))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top spending categories</CardTitle>
            <CardDescription className="hidden sm:block">Your most expensive categories across the full ledger.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topCategories.length ? (
              topCategories.map((category, index) => (
                <div key={category.id} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-full font-semibold text-slate-900" style={{ backgroundColor: category.color }}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{category.name}</p>
                        <p className="text-sm text-muted-foreground">Priority area</p>
                      </div>
                    </div>
                    <p className="font-semibold">{formatCurrency(category.spent, currency as never)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                Add expense transactions to unlock category rankings.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Signals</CardTitle>
          <CardDescription className="hidden sm:block">Simple signals that help you improve savings resilience each month.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[28px] border border-border/60 bg-background/70 p-5">
            <Badge className="mb-3 gap-1 rounded-full">
              <TrendingUp className="size-3" />
              Savings momentum
            </Badge>
            <p className="text-sm leading-7 text-muted-foreground">A savings rate above 20% usually creates more room for goals and shocks.</p>
          </div>
          <div className="rounded-[28px] border border-border/60 bg-background/70 p-5">
            <Badge className="mb-3 rounded-full">Budget focus</Badge>
            <p className="text-sm leading-7 text-muted-foreground">If one category dominates spend, start there first.</p>
          </div>
          <div className="rounded-[28px] border border-border/60 bg-background/70 p-5">
            <Badge className="mb-3 rounded-full">Recurring pressure</Badge>
            <p className="text-sm leading-7 text-muted-foreground">Keep bills visible before they land on the ledger.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
