"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import {
  BarChart3,
  CreditCard,
  Goal,
  LayoutGrid,
  Loader2,
  LogOut,
  Menu,
  PiggyBank,
  Repeat2,
  Settings2,
  UserRound,
  Wallet
} from "lucide-react"
import { toast } from "sonner"

import { BrandMark } from "@/components/spendly/brand-mark"
import { ReminderCenter } from "@/components/spendly/reminder-center"
import { SiteFooter } from "@/components/spendly/site-footer"
import { ThemeToggle } from "@/components/spendly/theme-toggle"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { NAV_ITEMS } from "@/lib/constants"
import { type Profile, type ReminderCenterData, type AuthUser } from "@/lib/types"
import { cn, getInitials } from "@/lib/utils"

const navIcons = {
  "/dashboard": LayoutGrid,
  "/transactions": CreditCard,
  "/accounts": Wallet,
  "/budgets": PiggyBank,
  "/goals": Goal,
  "/recurring": Repeat2,
  "/insights": BarChart3,
  "/settings": Settings2
} as const

const mobileNavItems = [
  { href: "/dashboard", label: "Home", icon: LayoutGrid },
  { href: "/transactions", label: "Ledger", icon: CreditCard },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/budgets", label: "Budgets", icon: PiggyBank }
] as const

export function AppShell({
  user,
  profile,
  reminderCenter,
  children
}: {
  user: AuthUser
  profile: Profile | null
  reminderCenter: ReminderCenterData
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const moreRoutes = new Set(["/goals", "/recurring", "/insights", "/settings"])
  const mobileMoreActive = moreRoutes.has(pathname)

  const signOut = () => {
    startTransition(async () => {
      const response = await fetch("/api/auth/sign-out", { method: "POST" })
      if (!response.ok) {
        toast.error("Failed to sign out.")
        return
      }

      toast.success("Signed out.")
      router.push("/login")
      router.refresh()
    })
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-6 pt-6">
        <BrandMark />
      </div>
      <div className="px-6 pt-8">
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = navIcons[item.href]
            const active = pathname === item.href

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileNavOpen(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-glow"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
      <div className="mt-auto px-6 pb-6">
        <div className="rounded-[28px] border border-border/60 bg-card/70 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Currency</p>
          <p className="mt-2 font-display text-2xl font-semibold">{profile?.currency ?? "USD"}</p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="hidden border-r border-border/60 bg-card/50 lg:block">{sidebar}</aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <BrandMark className="lg:hidden" mobileCompact />
            </div>
            <div className="flex items-center gap-3">
              <ReminderCenter data={reminderCenter} />
              <ThemeToggle className="hidden sm:inline-flex" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-12 rounded-2xl px-3">
                    <Avatar className="size-8">
                      <AvatarFallback>{getInitials(profile?.full_name, user.email)}</AvatarFallback>
                    </Avatar>
                    <div className="hidden text-left sm:block">
                      <p className="text-sm font-semibold">{profile?.full_name ?? "Spendly User"}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <div className="px-2 py-1.5">
                    <p className="font-medium">{profile?.full_name ?? "Spendly User"}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="cursor-pointer">
                      <UserRound className="size-4" />
                      Profile settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={signOut}>
                    {isPending ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
        <main className="space-y-5 px-4 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:space-y-8 sm:px-6 sm:py-6 sm:pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:px-8 lg:pb-8">
          {children}
          <Separator />
          <SiteFooter className="pb-2 lg:pb-0" compact />
        </main>
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="w-[280px] p-0">
            {sidebar}
          </SheetContent>
          <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/90 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden">
            <div className="grid grid-cols-5 gap-1">
              {mobileNavItems.map((item) => {
                const Icon = item.icon
                const active = pathname === item.href

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition-colors",
                      active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
              <SheetTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition-colors",
                    mobileMoreActive || mobileNavOpen
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Menu className="size-4" />
                  <span>More</span>
                </button>
              </SheetTrigger>
            </div>
          </nav>
        </Sheet>
      </div>
    </div>
  )
}
