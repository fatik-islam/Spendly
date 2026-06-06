import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react"

import { BrandMark } from "@/components/spendly/brand-mark"
import { SiteFooter } from "@/components/spendly/site-footer"
import { ThemeToggle } from "@/components/spendly/theme-toggle"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getOptionalWorkspaceContext } from "@/lib/data"

export default async function HomePage() {
  const context = await getOptionalWorkspaceContext()

  if (context?.user) {
    redirect("/dashboard")
  }

  return (
    <main className="min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <BrandMark />
        <div className="flex w-auto items-center gap-3">
          <ThemeToggle />
          <Button asChild variant="outline" className="hidden sm:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/signup">Get started</Link>
          </Button>
        </div>
      </div>

      <section className="mx-auto grid max-w-7xl gap-6 py-8 sm:py-12 lg:grid-cols-[0.9fr_1fr] lg:items-center">
        <div className="space-y-6">
          <div className="space-y-4">
            <h1 className="max-w-3xl font-display text-4xl font-semibold leading-[1.02] tracking-tight text-balance sm:text-6xl">
              Personal finance that stays sharp on every screen.
            </h1>
            <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Track balances, budgets, bills, and savings in one calm dashboard.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button asChild size="lg">
              <Link href="/signup">
                Start free
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
            {[
              {
                title: "Balances",
                icon: CheckCircle2,
                detail: "Keep every account in view."
              },
              {
                title: "Budgets",
                icon: ShieldCheck,
                detail: "Catch overspending early."
              },
              {
                title: "Bills",
                icon: Sparkles,
                detail: "See what is due next."
              }
            ].map((item) => (
              <Card key={item.title} className="bg-card/70">
                <CardContent className="space-y-2 p-3 sm:space-y-3 sm:p-4">
                  <div className="inline-flex rounded-2xl bg-primary/15 p-2.5 text-primary sm:p-3">
                    <item.icon className="size-4 sm:size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold sm:text-base">{item.title}</p>
                    <p className="mt-1 hidden text-sm leading-6 text-muted-foreground sm:block">{item.detail}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-[32px] border border-border/60 bg-slate-950 p-4 text-white shadow-2xl sm:rounded-[36px] sm:p-6">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-cyan-400/15 to-blue-500/20" />
          <div className="absolute inset-0 bg-grid bg-[length:28px_28px] opacity-20" />
          <div className="relative space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <p className="text-sm text-slate-300">Total balance</p>
                <p className="mt-2 font-display text-3xl font-semibold sm:text-4xl">$24,860</p>
                <p className="mt-3 text-sm text-emerald-300">+12.5% this month</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <p className="text-sm text-slate-300">Net savings</p>
                <p className="mt-2 font-display text-3xl font-semibold sm:text-4xl">$3,480</p>
                <p className="mt-3 text-sm text-cyan-300">Savings rate 24%</p>
              </div>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-semibold">June spending trend</p>
                <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs text-emerald-300">Healthy pace</span>
              </div>
              <div className="mt-5 grid grid-cols-6 gap-2 sm:gap-3">
                {[54, 72, 61, 88, 64, 43].map((value, index) => (
                  <div key={index} className="flex flex-col items-center gap-3">
                    <div className="flex h-28 w-full items-end rounded-full bg-white/5 p-1.5 sm:h-36 sm:p-2">
                      <div
                        className="w-full rounded-full bg-gradient-to-t from-primary to-cyan-300"
                        style={{ height: `${value}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400">{["Jan", "Feb", "Mar", "Apr", "May", "Jun"][index]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <p className="text-sm text-slate-300">Top category</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-lg font-semibold">Food</p>
                  <p className="text-sm text-slate-300">$620</p>
                </div>
                <div className="mt-4 h-2 rounded-full bg-white/10">
                  <div className="h-2 w-[68%] rounded-full bg-amber-400" />
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <p className="text-sm text-slate-300">Upcoming bills</p>
                <div className="mt-3 space-y-3">
                  {[
                    ["Rent", "Jun 05"],
                    ["Netflix", "Jun 11"],
                    ["Gym", "Jun 16"]
                  ].map(([name, due]) => (
                    <div key={name} className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-3 py-2">
                      <span>{name}</span>
                      <span className="text-sm text-slate-300">{due}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-7xl">
        <SiteFooter className="pb-10" />
      </div>
    </main>
  )
}
