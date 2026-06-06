"use client"

import { useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Flag, Pencil, Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { deleteGoal, saveGoal } from "@/actions/finance"
import { ConfirmDialog } from "@/components/spendly/confirm-dialog"
import { EmptyState } from "@/components/spendly/empty-state"
import { PageHeader } from "@/components/spendly/page-header"
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
import { formatCurrency, formatDate } from "@/lib/format"
import { type CurrencyCode, type SavingsGoal } from "@/lib/types"
import { savingsGoalSchema } from "@/lib/validation/finance"
import { clamp, toCurrencyNumber } from "@/lib/utils"

type GoalValues = z.infer<typeof savingsGoalSchema>

const defaults: GoalValues = {
  name: "",
  targetAmount: 0,
  currentAmount: 0,
  deadline: ""
}

export function GoalsView({
  currency,
  goals
}: {
  currency: CurrencyCode
  goals: SavingsGoal[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SavingsGoal | null>(null)
  const [isPending, startTransition] = useTransition()
  const form = useForm<GoalValues>({
    resolver: zodResolver(savingsGoalSchema),
    defaultValues: defaults
  })

  const openCreate = () => {
    setEditingGoal(null)
    form.reset(defaults)
    setOpen(true)
  }

  const openEdit = (goal: SavingsGoal) => {
    setEditingGoal(goal)
    form.reset({
      id: goal.id,
      name: goal.name,
      targetAmount: toCurrencyNumber(goal.target_amount),
      currentAmount: toCurrencyNumber(goal.current_amount),
      deadline: goal.deadline ?? ""
    })
    setOpen(true)
  }

  const submit = (values: GoalValues) => {
    startTransition(async () => {
      const result = await saveGoal(values)
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
      const result = await deleteGoal(deleteTarget.id)
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
        title="Goals"
        description="Track target amounts and deadlines."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Add goal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>{editingGoal ? "Edit goal" : "Create goal"}</DialogTitle>
                <DialogDescription>Track the target, current progress, and optional deadline.</DialogDescription>
              </DialogHeader>
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(submit)}>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Goal name</Label>
                  <Input placeholder="Emergency fund" {...form.register("name")} />
                </div>
                <div className="space-y-2">
                  <Label>Target amount</Label>
                  <Input type="number" min="0" step="0.01" {...form.register("targetAmount", { valueAsNumber: true })} />
                </div>
                <div className="space-y-2">
                  <Label>Current amount</Label>
                  <Input type="number" min="0" step="0.01" {...form.register("currentAmount", { valueAsNumber: true })} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Deadline</Label>
                  <Input type="date" {...form.register("deadline")} />
                </div>
                <DialogFooter className="sm:col-span-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    {editingGoal ? "Save changes" : "Save goal"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {goals.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {goals.map((goal) => {
            const target = toCurrencyNumber(goal.target_amount)
            const current = toCurrencyNumber(goal.current_amount)
            const progress = target > 0 ? clamp((current / target) * 100, 0, 100) : 0

            return (
              <Card key={goal.id}>
                <CardContent className="space-y-5 p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-display text-2xl font-semibold">{goal.name}</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {goal.deadline ? `Deadline ${formatDate(goal.deadline)}` : "No deadline yet"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" onClick={() => openEdit(goal)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => setDeleteTarget(goal)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-[28px] bg-secondary/50 p-4">
                    <p className="text-sm text-muted-foreground">Goal progress</p>
                    <p className="mt-2 font-display text-3xl font-semibold sm:text-4xl">{Math.round(progress)}%</p>
                    <div className="mt-4">
                      <Progress value={progress} />
                    </div>
                  </div>
                  <div className="grid gap-4 text-sm sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                      <p className="text-muted-foreground">Current</p>
                      <p className="mt-2 font-semibold">{formatCurrency(current, currency as never)}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                      <p className="text-muted-foreground">Target</p>
                      <p className="mt-2 font-semibold">{formatCurrency(target, currency as never)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={Flag}
          title="No savings goals yet"
          description="Create a goal for an emergency fund, trip, device, or any other milestone."
          actionLabel="Add goal"
          onAction={openCreate}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(value) => {
          if (!value) setDeleteTarget(null)
        }}
        title="Delete goal?"
        description="This removes the goal and its progress history from your dashboard."
        confirmLabel="Delete goal"
        pending={isPending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
