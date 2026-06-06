"use client"

import { useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle, Pencil, Plus, Target, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { deleteBudget, saveBudget } from "@/actions/finance"
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
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency } from "@/lib/format"
import { summarizeBudgetState } from "@/lib/finance-utils"
import { type Category, type CurrencyCode } from "@/lib/types"
import { budgetSchema } from "@/lib/validation/finance"
import { toCurrencyNumber } from "@/lib/utils"

type BudgetValues = z.infer<typeof budgetSchema>

export function BudgetsView({
  currency,
  categories,
  budgets
}: {
  currency: CurrencyCode
  categories: Category[]
  budgets: Array<{
    id: string
    category_id: string
    month: number
    year: number
    amount: number | string
    spent: number
    remaining: number
    progress: number
    category?: { name: string; color: string }
  }>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<(typeof budgets)[number] | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<(typeof budgets)[number] | null>(null)
  const [isPending, startTransition] = useTransition()
  const form = useForm<BudgetValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      categoryId: "",
      amount: 0,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear()
    }
  })

  const openCreate = () => {
    setEditingBudget(null)
    form.reset({
      categoryId: "",
      amount: 0,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear()
    })
    setOpen(true)
  }

  const openEdit = (budget: (typeof budgets)[number]) => {
    setEditingBudget(budget)
    form.reset({
      id: budget.id,
      categoryId: budget.category_id,
      amount: toCurrencyNumber(budget.amount),
      month: budget.month,
      year: budget.year
    })
    setOpen(true)
  }

  const submit = (values: BudgetValues) => {
    startTransition(async () => {
      const result = await saveBudget(values)
      if (!result.ok) {
        toast.error(result.message)
        return
      }

      toast.success(result.message)
      setOpen(false)
      router.refresh()
    })
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteBudget(deleteTarget.id)
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
        title="Budgets"
        description="Set monthly limits and watch category pace."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Add budget
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>{editingBudget ? "Edit budget" : "Create budget"}</DialogTitle>
                <DialogDescription>Budgets are tracked per category and month.</DialogDescription>
              </DialogHeader>
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(submit)}>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Category</Label>
                  <Select value={form.watch("categoryId")} onValueChange={(value) => form.setValue("categoryId", value, { shouldValidate: true })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
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
                  <Label>Month</Label>
                  <Input type="number" min="1" max="12" {...form.register("month", { valueAsNumber: true })} />
                </div>
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Input type="number" min="2024" max="2100" {...form.register("year", { valueAsNumber: true })} />
                </div>
                <DialogFooter className="sm:col-span-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    {editingBudget ? "Save changes" : "Save budget"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {budgets.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {budgets.map((budget) => (
            <Card key={budget.id}>
              <CardContent className="space-y-5 p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="size-3 rounded-full" style={{ backgroundColor: budget.category?.color ?? "#14B8A6" }} />
                      <p className="font-display text-2xl font-semibold">{budget.category?.name ?? "Category"}</p>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {budget.month}/{budget.year}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={budget.progress >= 100 ? "destructive" : "default"}>{summarizeBudgetState(budget.progress)}</Badge>
                    <Button variant="outline" size="icon" onClick={() => openEdit(budget)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setDeleteTarget(budget)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="rounded-[28px] bg-secondary/50 p-4">
                  <p className="text-sm text-muted-foreground">Progress</p>
                  <p className="mt-2 font-display text-3xl font-semibold sm:text-4xl">{Math.round(budget.progress)}%</p>
                  <div className="mt-4">
                    <Progress value={budget.progress} />
                  </div>
                </div>
                <div className="grid gap-4 text-sm sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <p className="text-muted-foreground">Spent</p>
                    <p className="mt-2 font-semibold">{formatCurrency(budget.spent, currency as never)}</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <p className="text-muted-foreground">Budget</p>
                    <p className="mt-2 font-semibold">{formatCurrency(toCurrencyNumber(budget.amount), currency as never)}</p>
                  </div>
                </div>
                {budget.progress >= 80 ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="size-4" />
                    {budget.progress >= 100 ? "This budget has been exceeded." : "This budget is above the 80% warning threshold."}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Target}
          title="No budgets yet"
          description="Create category budgets to watch spending pace."
          actionLabel="Add budget"
          onAction={openCreate}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(value) => {
          if (!value) setDeleteTarget(null)
        }}
        title="Delete budget?"
        description="This removes the monthly target and its progress indicator from your dashboard."
        confirmLabel="Delete budget"
        pending={isPending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
