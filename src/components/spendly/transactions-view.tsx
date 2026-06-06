"use client"

import { useDeferredValue, useMemo, useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarDays, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { deleteTransaction, saveTransaction } from "@/actions/finance"
import { CategoryIcon } from "@/components/spendly/category-icon"
import { formatCurrency, formatDate } from "@/lib/format"
import { type Account, type Category, type CurrencyCode, type Transaction } from "@/lib/types"
import { transactionSchema } from "@/lib/validation/finance"
import { toCurrencyNumber } from "@/lib/utils"

type TransactionFormValues = z.infer<typeof transactionSchema>

const defaultValues: TransactionFormValues = {
  accountId: "",
  transferAccountId: null,
  categoryId: null,
  type: "expense",
  amount: 0,
  description: "",
  notes: "",
  transactionDate: new Date().toISOString().slice(0, 10),
  isRecurring: false
}

export function TransactionsView({
  currency,
  transactions,
  accounts,
  categories
}: {
  currency: CurrencyCode
  transactions: Transaction[]
  accounts: Account[]
  categories: Category[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedType, setSelectedType] = useState<"all" | "income" | "expense" | "transfer">("all")
  const [selectedAccount, setSelectedAccount] = useState("all")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedDate, setSelectedDate] = useState("")
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)
  const [isPending, startTransition] = useTransition()
  const deferredSearch = useDeferredValue(search)
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues
  })

  const activeType = form.watch("type")

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const searchMatch =
        deferredSearch.length === 0 ||
        transaction.description.toLowerCase().includes(deferredSearch.toLowerCase()) ||
        transaction.notes?.toLowerCase().includes(deferredSearch.toLowerCase()) ||
        transaction.category?.name.toLowerCase().includes(deferredSearch.toLowerCase())

      const typeMatch = selectedType === "all" || transaction.type === selectedType
      const accountMatch = selectedAccount === "all" || transaction.account_id === selectedAccount || transaction.transfer_account_id === selectedAccount
      const categoryMatch = selectedCategory === "all" || transaction.category_id === selectedCategory
      const dateMatch = selectedDate.length === 0 || transaction.transaction_date === selectedDate

      return searchMatch && typeMatch && accountMatch && categoryMatch && dateMatch
    })
  }, [deferredSearch, selectedAccount, selectedCategory, selectedDate, selectedType, transactions])

  const openCreate = () => {
    setEditingTransaction(null)
    form.reset(defaultValues)
    setOpen(true)
  }

  const openEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction)
    form.reset({
      id: transaction.id,
      accountId: transaction.account_id,
      transferAccountId: transaction.transfer_account_id,
      categoryId: transaction.category_id,
      type: transaction.type,
      amount: toCurrencyNumber(transaction.amount),
      description: transaction.description,
      notes: transaction.notes ?? "",
      transactionDate: transaction.transaction_date,
      isRecurring: transaction.is_recurring
    })
    setOpen(true)
  }

  const submit = (values: TransactionFormValues) => {
    startTransition(async () => {
      const result = await saveTransaction(values)
      if (!result.ok) {
        toast.error(result.message)
        return
      }

      toast.success(result.message)
      setOpen(false)
      router.refresh()
    })
  }

  const handleDelete = () => {
    if (!deleteTarget) return

    startTransition(async () => {
      const result = await deleteTransaction(deleteTarget.id)
      if (!result.ok) {
        toast.error(result.message)
        return
      }

      toast.success(result.message)
      setDeleteTarget(null)
      router.refresh()
    })
  }

  const filteredCategories = categories.filter((category) => {
    if (activeType === "transfer") return false
    if (activeType === "income") return category.type === "income"
    return category.type === "expense"
  })

  return (
    <div className="space-y-8">
      <PageHeader
        title="Ledger"
        description="Track income, expenses, and transfers."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Add transaction
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingTransaction ? "Edit transaction" : "Add transaction"}</DialogTitle>
                  <DialogDescription>Save money movement with accounts, categories, notes, and recurrence.</DialogDescription>
                </DialogHeader>
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(submit)}>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Type</Label>
                  <Select
                    value={activeType}
                    onValueChange={(value) => {
                      form.setValue("type", value as TransactionFormValues["type"])
                      if (value === "transfer") {
                        form.setValue("categoryId", null)
                      } else {
                        form.setValue("transferAccountId", null)
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select transaction type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
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
                  {form.formState.errors.accountId ? <p className="text-sm text-destructive">{form.formState.errors.accountId.message}</p> : null}
                </div>
                {activeType === "transfer" ? (
                  <div className="space-y-2">
                    <Label>Destination account</Label>
                    <Select
                      value={form.watch("transferAccountId") ?? ""}
                      onValueChange={(value) => form.setValue("transferAccountId", value, { shouldValidate: true })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose destination" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.transferAccountId ? (
                      <p className="text-sm text-destructive">{form.formState.errors.transferAccountId.message}</p>
                    ) : null}
                  </div>
                ) : (
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
                    {form.formState.errors.categoryId ? <p className="text-sm text-destructive">{form.formState.errors.categoryId.message}</p> : null}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input placeholder="Dinner, salary, or transfer" {...form.register("description")} />
                  {form.formState.errors.description ? <p className="text-sm text-destructive">{form.formState.errors.description.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input type="number" min="0" step="0.01" {...form.register("amount", { valueAsNumber: true })} />
                  {form.formState.errors.amount ? <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" {...form.register("transactionDate")} />
                  {form.formState.errors.transactionDate ? (
                    <p className="text-sm text-destructive">{form.formState.errors.transactionDate.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Notes</Label>
                  <Textarea placeholder="Optional context, memo, or receipt reference" {...form.register("notes")} />
                </div>
                <label className="flex items-start gap-3 rounded-2xl border border-border/60 bg-secondary/40 px-4 py-3 text-sm sm:col-span-2">
                  <input type="checkbox" className="size-4 rounded border-border" {...form.register("isRecurring")} />
                  Mark this transaction as part of a recurring cadence
                </label>
                <DialogFooter className="sm:col-span-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    {editingTransaction ? "Save changes" : "Save transaction"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-5">
          <div className="space-y-2 sm:col-span-2 xl:col-span-2">
            <Label>Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" placeholder="Search description, notes, or category" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={selectedType} onValueChange={(value) => setSelectedType(value as typeof selectedType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Account</Label>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 xl:col-span-5">
            <Button
              type="button"
              variant="ghost"
              className="w-full sm:w-auto"
              onClick={() => {
                setSearch("")
                setSelectedType("all")
                setSelectedAccount("all")
                setSelectedCategory("all")
                setSelectedDate("")
              }}
            >
              Clear filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {filteredTransactions.length ? (
        <div className="space-y-3">
          {filteredTransactions.map((transaction) => (
            <Card key={transaction.id}>
              <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <div
                    className="rounded-2xl p-3"
                    style={{
                      backgroundColor: `${transaction.category?.color ?? "#14B8A6"}20`,
                      color: transaction.category?.color ?? "#14B8A6"
                    }}
                  >
                    <CategoryIcon icon={transaction.category?.icon} className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{transaction.description}</p>
                      {transaction.is_recurring ? <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">Recurring</span> : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {transaction.account?.name}
                      {transaction.transfer_account ? ` → ${transaction.transfer_account.name}` : ""}
                      {" · "}
                      {transaction.category?.name ?? "Transfer"}
                    </p>
                    {transaction.notes ? <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{transaction.notes}</p> : null}
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 lg:justify-end">
                  <div className="text-left sm:min-w-[11rem] lg:text-right">
                    <p className={`font-display text-2xl font-semibold ${transaction.type === "expense" ? "text-rose-500" : "text-emerald-500"}`}>
                      {transaction.type === "expense" ? "-" : "+"}
                      {formatCurrency(toCurrencyNumber(transaction.amount), currency as never)}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground lg:justify-end">
                      <CalendarDays className="size-4" />
                      {formatDate(transaction.transaction_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <Button variant="outline" size="icon" onClick={() => openEdit(transaction)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setDeleteTarget(transaction)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Plus}
          title="No matching transactions"
          description="Add income, expenses, or transfers, then narrow them with filters."
          actionLabel="Add transaction"
          onAction={openCreate}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(value) => {
          if (!value) setDeleteTarget(null)
        }}
        title="Delete transaction?"
        description="This will remove the transaction and automatically recalculate the affected account balances."
        confirmLabel="Delete"
        pending={isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
