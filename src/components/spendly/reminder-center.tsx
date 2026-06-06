"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { BellRing, Check, Loader2, MailCheck, X } from "lucide-react"
import { toast } from "sonner"

import { dismissReminder, markReminderRead } from "@/actions/reminders"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatDate } from "@/lib/format"
import { type ReminderCenterData } from "@/lib/types"
import { cn } from "@/lib/utils"

export function ReminderCenter({
  data
}: {
  data: ReminderCenterData
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const runAction = (action: () => Promise<{ ok: boolean; message: string }>) => {
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        toast.error(result.message)
        return
      }

      toast.success(result.message)
      router.refresh()
    })
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <BellRing className="size-4" />
          {data.unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white">
              {data.unreadCount > 9 ? "9+" : data.unreadCount}
            </span>
          ) : null}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reminder center</DialogTitle>
          <DialogDescription>
            {data.unreadCount > 0
              ? `${data.unreadCount} active alerts, including ${data.overdueCount} overdue item${data.overdueCount === 1 ? "" : "s"}.`
              : "No active reminders right now."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Unread</p>
            <p className="mt-2 font-display text-3xl font-semibold">{data.unreadCount}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Upcoming</p>
            <p className="mt-2 font-display text-3xl font-semibold">{data.upcomingCount}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Overdue</p>
            <p className="mt-2 font-display text-3xl font-semibold text-rose-500">{data.overdueCount}</p>
          </div>
        </div>
        <ScrollArea className="max-h-[420px] pr-4">
          <div className="space-y-3">
            {data.items.length ? (
              data.items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-[24px] border border-border/60 bg-background/70 p-4",
                    !item.read_at && "border-primary/30 bg-primary/5"
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{item.title}</p>
                        <Badge variant={item.kind === "overdue" ? "destructive" : "outline"}>{item.kind}</Badge>
                        {item.email_sent_at ? (
                          <Badge variant="secondary">
                            <MailCheck className="mr-1 size-3" />
                            Email sent
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">{item.body}</p>
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        Due {formatDate(item.due_date, "MMM d")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!item.read_at ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() => runAction(() => markReminderRead(item.id))}
                        >
                          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                          Mark read
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => runAction(() => dismissReminder(item.id))}
                      >
                        <X className="size-4" />
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                Spendly will surface recurring bills and income cycles here once they enter your reminder window.
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Tune lead time and email delivery from settings.</p>
          <Button asChild variant="outline">
            <Link href="/settings">Open settings</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
