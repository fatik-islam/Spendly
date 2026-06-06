import { ReactNode } from "react"

import { BrandMark } from "@/components/spendly/brand-mark"
import { SiteFooter } from "@/components/spendly/site-footer"
import { ThemeToggle } from "@/components/spendly/theme-toggle"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function AuthCard({
  title,
  description,
  children,
  footer
}: {
  title: string
  description: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="relative mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-6 flex items-center justify-between gap-3 sm:mb-8">
        <BrandMark />
        <ThemeToggle />
      </div>
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1fr]">
        <div className="relative hidden overflow-hidden rounded-[32px] border border-border/60 bg-card/70 p-8 shadow-panel lg:block">
          <div className="absolute inset-0 bg-grid bg-[length:28px_28px] opacity-25 [mask-image:radial-gradient(circle_at_top_left,white,transparent_80%)]" />
          <div className="relative space-y-6">
            <h1 className="max-w-md font-display text-4xl font-semibold leading-tight text-balance">
              Your money, in one calm dashboard.
            </h1>
            <p className="max-w-md text-base leading-7 text-muted-foreground">
              Track balances, budgets, bills, and goals without the clutter.
            </p>
            <div className="grid gap-3 pt-2 xl:grid-cols-3">
              <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Balances</p>
                <p className="mt-2 text-lg font-semibold">All accounts</p>
              </div>
              <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Budgets</p>
                <p className="mt-2 text-lg font-semibold">Monthly pace</p>
              </div>
              <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Bills</p>
                <p className="mt-2 text-lg font-semibold">Due next</p>
              </div>
            </div>
          </div>
        </div>
        <Card className="overflow-hidden border-border/70">
          <CardHeader className="pb-4">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {children}
            {footer}
          </CardContent>
        </Card>
      </div>
      <SiteFooter className="mt-8" compact />
    </div>
  )
}
