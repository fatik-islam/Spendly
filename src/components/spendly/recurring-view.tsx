"use client"

import { useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { BellRing, Pencil, Plus, Repeat2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { deleteRecurringTransaction, saveRecurringTransaction, toggleRecurringTransaction } from "@/actions/finance"
import { ConfirmDialog } from "@/components/spendly/confirm-dialog"
import { EmptyState } from "@/components/spendly/empty-state"
import { PageHeader } from "@/components/spendly/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency, formatDate } from "@/lib/format"
import { type Account, type Category, type CurrencyCode, type RecurringTransaction } from "@/lib/types"
import { recurringTransactionSchema } from "@/lib/validation/finance"
import { toCurrencyNumber } from "@/lib/utils"

type RecurringValues = z.infer<typeof recurringTransactionSchema>

const defaults: RecurringValues = {
  accountId: "",
  categoryId: null,
  type: "expense",
  amount: 0,
  description: "",
  frequency: "monthly",
  nextDueDate: new Date().toISOString().slice(0, 10),
  active: true
}

export function RecurringView({
  currency,
  accounts,
  categories,
  recurringTransactions,
  reminderCenter,
  reminderPreferences
}: {
  currency: CurrencyCode
  accounts: Account[]
  categories: Category[]
  recurringTransactions: RecurringTransaction[]
  reminderCenter: {
    unreadCount: number
    overdueCount: number
    upcomingCount: number
  }
  reminderPreferences: {
    reminderDaysBefore: number
    reminderInAppEnabled: boolean
    reminderEmailEnabled: boolean
  }
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<RecurringTransaction | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RecurringTransaction | null>(null)
  const [isPending, startTransition] = useTransition()
  const form = useForm<RecurringValues>({
    resolver: zodResolver(recurringTransactionSchema),
    defaultValues: defaults
  })
  const currentType = form.watch("type")

  const filteredCategories = categories.filter((category) => category.type === currentType)

  const openCreate = () => {
    setEditingItem(null)
    form.reset(defaults)
    setOpen(true)
  }

  const openEdit = (item: RecurringTransaction) => {
    setEditingItem(item)
    form.reset({
      id: item.id,
      accountId: item.account_id,
      categoryId: item.category_id,
      type: item.type,
      amount: toCurrencyNumber(item.amount),
      description: item.description,
      frequency: item.frequency,
      nextDueDate: item.next_due_date,
      active: item.active
    })
    setOpen(true)
  }

  const submit = (values: RecurringValues) => {
    startTransition(async () => {
      const result = await saveRecurringTransaction(values)
      if (!result.ok) {
        toast.error(result.message)
        return
      }

      toast.success(result.message)
      setOpen(false)
      router.refresh()
    })
  }

  const toggleItem = (item: RecurringTransaction) => {
    startTransition(async () => {
      const result = await toggleRecurringTransaction(item.id, !item.active)
      if (!result.ok) {
        toast.error(result.message)
        return
      }

      toast.success(result.message)
      router.refresh()
    })
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteRecurringTransaction(deleteTarget.id)
      if (!result.ok) {
        toast.error(result.message)
        return
      }

      toast.success(result.message)
      setDeleteTarget(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Recurring"
        description="Stay ahead of bills and repeating income."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Add item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>{editingItem ? "Edit recurring item" : "Create recurring item"}</DialogTitle>
                <DialogDescription>Use this for bills, subscriptions, salary, or renewals.</DialogDescription>
              </DialogHeader>
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(submit)}>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Description</Label>
                  <Input placeholder="Netflix subscription" {...form.register("description")} />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={currentType} onValueChange={(value) => form.setValue("type", value as RecurringValues["type"])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select value={form.watch("frequency")} onValueChange={(value) => form.setValue("frequency", value as RecurringValues["frequency"])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Account</Label>
                  <Select value={form.watch("accountId")} onValueChange={(value) => form.setValue("accountId", value, { shouldValidate: true })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.watch("categoryId") ?? ""} onValueChange={(value) => form.setValue("categoryId", value, { shouldValidate: true })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose category" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input type="number" min="0" step="0.01" {...form.register("amount", { valueAsNumber: true })} />
                </div>
                <div className="space-y-2">
                  <Label>Next due date</Label>
                  <Input type="date" {...form.register("nextDueDate")} />
                </div>
                <label className="flex items-center gap-3 rounded-2xl border border-border/60 bg-secondary/40 px-4 py-3 text-sm sm:col-span-2">
                  <input type="checkbox" className="size-4 rounded border-border" checked={form.watch("active")} onChange={(event) => form.setValue("active", event.target.checked)} />
                  Keep this item active
                </label>
                <DialogFooter className="sm:col-span-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    {editingItem ? "Save changes" : "Save item"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.9fr_0.9fr]">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="space-y-3 p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <BellRing className="size-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Reminder inbox</p>
                <p className="font-display text-3xl font-semibold">{reminderCenter.unreadCount}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {reminderCenter.overdueCount > 0
                ? `${reminderCenter.overdueCount} overdue alert${reminderCenter.overdueCount === 1 ? "" : "s"} need attention.`
                : "No overdue recurring items right now."}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Lead time</p>
            <p className="font-display text-3xl font-semibold">{reminderPreferences.reminderDaysBefore}d</p>
            <p className="text-sm text-muted-foreground">
              In-app alerts are {reminderPreferences.reminderInAppEnabled ? "enabled" : "paused"} for bills entering the reminder window.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Email delivery</p>
            <p className="font-display text-3xl font-semibold">{reminderPreferences.reminderEmailEnabled ? "On" : "Off"}</p>
            <p className="text-sm text-muted-foreground">
              Spendly emails only unread alerts, so the header inbox remains the primary source of truth.
            </p>
          </CardContent>
        </Card>
      </div>

      {recurringTransactions.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {recurringTransactions.map((item) => (
            <Card key={item.id}>
              <CardContent className="space-y-5 p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-display text-2xl font-semibold">{item.description}</p>
                      <Badge variant={item.active ? "default" : "outline"}>{item.active ? "Active" : "Paused"}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {item.account?.name ?? "Account"} · {item.frequency}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => openEdit(item)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setDeleteTarget(item)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="rounded-[28px] bg-secondary/50 p-4">
                  <p className="text-sm text-muted-foreground">Upcoming amount</p>
                  <p className={`mt-2 break-words font-display text-3xl font-semibold sm:text-4xl ${item.type === "expense" ? "text-rose-500" : "text-emerald-500"}`}>
                    {item.type === "expense" ? "-" : "+"}
                    {formatCurrency(toCurrencyNumber(item.amount), currency as never)}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">Due {formatDate(item.next_due_date)}</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">{item.category?.name ?? "No category"}</p>
                  <Button variant="outline" onClick={() => toggleItem(item)}>
                    <BellRing className="size-4" />
                    {item.active ? "Pause" : "Resume"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Repeat2}
          title="No recurring items yet"
          description="Create reminders for subscriptions, bills, and repeating income so upcoming money events never surprise you."
          actionLabel="Add recurring item"
          onAction={openCreate}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(value) => {
          if (!value) setDeleteTarget(null)
        }}
        title="Delete recurring item?"
        description="This removes the reminder from your dashboard and upcoming payment list."
        confirmLabel="Delete recurring item"
        pending={isPending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
