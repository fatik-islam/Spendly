"use client"

import { useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowRightLeft, Pencil, Plus, Trash2, Wallet2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { deleteAccount, saveAccount, saveTransaction } from "@/actions/finance"
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
import { Textarea } from "@/components/ui/textarea"
import { ACCOUNT_TYPES } from "@/lib/constants"
import { formatCurrency } from "@/lib/format"
import { type Account, type CurrencyCode } from "@/lib/types"
import { accountSchema, transactionSchema } from "@/lib/validation/finance"
import { toCurrencyNumber } from "@/lib/utils"

type AccountValues = z.infer<typeof accountSchema>
type TransferValues = z.infer<typeof transactionSchema>

const accountDefaults: AccountValues = {
  name: "",
  type: "cash",
  balance: 0,
  currency: "USD"
}

const transferDefaults: TransferValues = {
  accountId: "",
  transferAccountId: null,
  categoryId: null,
  type: "transfer",
  amount: 0,
  description: "Account transfer",
  notes: "",
  transactionDate: new Date().toISOString().slice(0, 10),
  isRecurring: false
}

export function AccountsView({
  currency,
  accounts
}: {
  currency: CurrencyCode
  accounts: Array<Account & { activityCount: number }>
}) {
  const router = useRouter()
  const [accountOpen, setAccountOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<(Account & { activityCount: number }) | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<(Account & { activityCount: number }) | null>(null)
  const [isPending, startTransition] = useTransition()
  const accountForm = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { ...accountDefaults, currency }
  })
  const transferForm = useForm<TransferValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: transferDefaults
  })

  const openCreate = () => {
    setEditingAccount(null)
    accountForm.reset({ ...accountDefaults, currency })
    setAccountOpen(true)
  }

  const openEdit = (account: Account & { activityCount: number }) => {
    setEditingAccount(account)
    accountForm.reset({
      id: account.id,
      name: account.name,
      type: account.type,
      balance: toCurrencyNumber(account.balance),
      currency: account.currency
    })
    setAccountOpen(true)
  }

  const submitAccount = (values: AccountValues) => {
    startTransition(async () => {
      const result = await saveAccount(values)
      if (!result.ok) {
        toast.error(result.message)
        return
      }

      toast.success(result.message)
      setAccountOpen(false)
      router.refresh()
    })
  }

  const submitTransfer = (values: TransferValues) => {
    startTransition(async () => {
      const result = await saveTransaction({
        ...values,
        type: "transfer",
        categoryId: null
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }

      toast.success("Transfer completed.")
      setTransferOpen(false)
      transferForm.reset(transferDefaults)
      router.refresh()
    })
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteAccount(deleteTarget.id)
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
        title="Accounts"
        description="Manage accounts and move money between them."
        action={
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={() => transferForm.reset(transferDefaults)}>
                  <ArrowRightLeft className="size-4" />
                  Transfer
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>Transfer between accounts</DialogTitle>
                  <DialogDescription>Move money between your own accounts.</DialogDescription>
                </DialogHeader>
                <form className="grid gap-4 sm:grid-cols-2" onSubmit={transferForm.handleSubmit(submitTransfer)}>
                  <div className="space-y-2">
                    <Label>From account</Label>
                    <Select value={transferForm.watch("accountId")} onValueChange={(value) => transferForm.setValue("accountId", value, { shouldValidate: true })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose source" />
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
                    <Label>To account</Label>
                    <Select
                      value={transferForm.watch("transferAccountId") ?? ""}
                      onValueChange={(value) => transferForm.setValue("transferAccountId", value, { shouldValidate: true })}
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
                  </div>
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input type="number" min="0" step="0.01" {...transferForm.register("amount", { valueAsNumber: true })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" {...transferForm.register("transactionDate")} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Description</Label>
                    <Input placeholder="Emergency fund top-up" {...transferForm.register("description")} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Notes</Label>
                    <Textarea placeholder="Optional note for the transfer" {...transferForm.register("notes")} />
                  </div>
                  <DialogFooter className="sm:col-span-2">
                    <Button type="button" variant="outline" onClick={() => setTransferOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isPending}>
                      Save transfer
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}>
                  <Plus className="size-4" />
                  Add account
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>{editingAccount ? "Edit account" : "Add account"}</DialogTitle>
                  <DialogDescription>Name the account and set its balance.</DialogDescription>
                </DialogHeader>
                <form className="grid gap-4 sm:grid-cols-2" onSubmit={accountForm.handleSubmit(submitAccount)}>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Name</Label>
                    <Input placeholder="Travel savings" {...accountForm.register("name")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={accountForm.watch("type")} onValueChange={(value) => accountForm.setValue("type", value as AccountValues["type"])}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACCOUNT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Current balance</Label>
                    <Input type="number" step="0.01" {...accountForm.register("balance", { valueAsNumber: true })} />
                  </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Input {...accountForm.register("currency")} />
                </div>
                  <DialogFooter className="sm:col-span-2">
                    <Button type="button" variant="outline" onClick={() => setAccountOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isPending}>
                      {editingAccount ? "Save changes" : "Create account"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {accounts.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardContent className="space-y-5 p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <Badge variant="outline" className="mb-3 rounded-full">
                      {account.type}
                    </Badge>
                    <p className="font-display text-2xl font-semibold">{account.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{account.activityCount} ledger events</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => openEdit(account)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setDeleteTarget(account)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="rounded-[28px] bg-secondary/50 p-4">
                  <p className="text-sm text-muted-foreground">Current balance</p>
                  <p className="mt-2 break-words font-display text-3xl font-semibold sm:text-4xl">
                    {formatCurrency(toCurrencyNumber(account.balance), currency as never)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Wallet2}
          title="No accounts yet"
          description="Create your first account to start tracking balances and transfers."
          actionLabel="Add account"
          onAction={openCreate}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(value) => {
          if (!value) setDeleteTarget(null)
        }}
        title="Delete account?"
        description="Accounts with transaction history cannot be deleted. Empty accounts can be removed safely."
        confirmLabel="Delete account"
        pending={isPending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
