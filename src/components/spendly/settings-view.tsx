"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Download, KeyRound, Palette, Pencil, Plus, Trash2, Upload, UserRound } from "lucide-react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { deleteCategory, saveCategory } from "@/actions/finance"
import { updateReminderPreferences } from "@/actions/reminders"
import { updateProfile } from "@/actions/settings"
import { CategoryIcon } from "@/components/spendly/category-icon"
import { ConfirmDialog } from "@/components/spendly/confirm-dialog"
import { DemoWorkspaceButton } from "@/components/spendly/demo-workspace-button"
import { EmptyState } from "@/components/spendly/empty-state"
import { PageHeader } from "@/components/spendly/page-header"
import { ThemeToggle } from "@/components/spendly/theme-toggle"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { CATEGORY_COLOR_PALETTE, CATEGORY_ICON_MAP, CURRENCY_OPTIONS } from "@/lib/constants"
import { type Category, type Profile, type AuthUser } from "@/lib/types"
import { categorySchema } from "@/lib/validation/finance"
import { EXPORT_DATASETS } from "@/lib/export-config"
import { profileSchema, reminderPreferencesSchema } from "@/lib/validation/settings"

type ProfileValues = z.infer<typeof profileSchema>
type ReminderPreferencesValues = z.infer<typeof reminderPreferencesSchema>
type CategoryValues = z.infer<typeof categorySchema>

interface ImportResult {
  message: string
  summary?: {
    totalRows: number
    importedCount: number
    duplicateCount: number
    errorCount: number
    createdAccounts: string[]
    createdCategories: string[]
    errors: Array<{ row: number; message: string }>
  }
}

export function SettingsView({
  user,
  profile,
  categories,
  canLoadDemoData
}: {
  user: AuthUser
  profile: Profile | null
  categories: Category[]
  canLoadDemoData: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [isPending, startTransition] = useTransition()
  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile?.full_name ?? "",
      currency: profile?.currency ?? "USD"
    }
  })
  const reminderForm = useForm<ReminderPreferencesValues>({
    resolver: zodResolver(reminderPreferencesSchema),
    defaultValues: {
      reminderDaysBefore: profile?.reminder_days_before ?? 3,
      reminderInAppEnabled: profile?.reminder_in_app_enabled ?? true,
      reminderEmailEnabled: profile?.reminder_email_enabled ?? false
    }
  })
  const categoryForm = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      type: "expense",
      color: CATEGORY_COLOR_PALETTE[0],
      icon: Object.keys(CATEGORY_ICON_MAP)[0] ?? "piggy-bank"
    }
  })

  const customCategories = categories.filter((category) => !category.is_default)

  const openCreate = () => {
    setEditingCategory(null)
    categoryForm.reset({
      name: "",
      type: "expense",
      color: CATEGORY_COLOR_PALETTE[0],
      icon: Object.keys(CATEGORY_ICON_MAP)[0] ?? "piggy-bank"
    })
    setOpen(true)
  }

  const openEdit = (category: Category) => {
    setEditingCategory(category)
    categoryForm.reset({
      id: category.id,
      name: category.name,
      type: category.type,
      color: category.color,
      icon: category.icon
    })
    setOpen(true)
  }

  const submitProfile = (values: ProfileValues) => {
    startTransition(async () => {
      const result = await updateProfile(values)
      if (!result.ok) {
        toast.error(result.message)
        return
      }

      toast.success(result.message)
      router.refresh()
    })
  }

  const submitCategory = (values: CategoryValues) => {
    startTransition(async () => {
      const result = await saveCategory(values)
      if (!result.ok) {
        toast.error(result.message)
        return
      }

      toast.success(result.message)
      setOpen(false)
      router.refresh()
    })
  }

  const submitReminderPreferences = (values: ReminderPreferencesValues) => {
    startTransition(async () => {
      const result = await updateReminderPreferences(values)
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
      const result = await deleteCategory(deleteTarget.id)
      if (!result.ok) {
        toast.error(result.message)
        return
      }

      toast.success(result.message)
      setDeleteTarget(null)
      router.refresh()
    })
  }

  const handleImport = () => {
    if (!importFile) {
      toast.error("Choose a CSV file first.")
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.set("file", importFile)

      const response = await fetch("/api/import/csv", {
        method: "POST",
        body: formData
      })

      const payload = (await response.json()) as ImportResult
      setImportResult(payload)

      if (!response.ok) {
        toast.error(payload.message ?? "Import failed.")
        return
      }

      setImportFile(null)
      setFileInputKey((value) => value + 1)
      toast.success(payload.message)
      router.refresh()
    })
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Profile, theme, data, and categories."
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Profile settings</CardTitle>
            <CardDescription className="hidden sm:block">Name and currency for this workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={profileForm.handleSubmit(submitProfile)}>
              <div className="space-y-2 sm:col-span-2">
                <Label>Full name</Label>
                <Input placeholder="Alex Morgan" {...profileForm.register("fullName")} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user.email ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={profileForm.watch("currency")} onValueChange={(value) => profileForm.setValue("currency", value as ProfileValues["currency"])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={isPending}>
                  <UserRound className="size-4" />
                  Save profile
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workspace preferences</CardTitle>
            <CardDescription className="hidden sm:block">Appearance, reminders, import, and export.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-[28px] border border-border/60 bg-background/70 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">Theme</p>
                  <p className="mt-1 text-sm text-muted-foreground">Light, dark, or system.</p>
                </div>
                <ThemeToggle variant="default" className="w-full sm:w-auto" />
              </div>
            </div>
            <div className="rounded-[28px] border border-border/60 bg-background/70 p-5">
              <form className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_160px_180px_180px_auto]" onSubmit={reminderForm.handleSubmit(submitReminderPreferences)}>
                <div>
                  <p className="font-semibold">Recurring reminders</p>
                  <p className="mt-1 text-sm text-muted-foreground">Lead time and channels.</p>
                </div>
                <div className="space-y-2">
                  <Label>Lead time</Label>
                  <Input type="number" min="0" max="30" {...reminderForm.register("reminderDaysBefore", { valueAsNumber: true })} />
                </div>
                <div className="space-y-2">
                  <Label>In-app alerts</Label>
                  <Select
                    value={reminderForm.watch("reminderInAppEnabled") ? "enabled" : "disabled"}
                    onValueChange={(value) => {
                      const enabled = value === "enabled"
                      reminderForm.setValue("reminderInAppEnabled", enabled)
                      if (!enabled) {
                        reminderForm.setValue("reminderEmailEnabled", false)
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enabled">Enabled</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Email alerts</Label>
                  <Select
                    value={reminderForm.watch("reminderEmailEnabled") ? "enabled" : "disabled"}
                    onValueChange={(value) => reminderForm.setValue("reminderEmailEnabled", value === "enabled")}
                    disabled={!reminderForm.watch("reminderInAppEnabled")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="disabled">Disabled</SelectItem>
                      <SelectItem value="enabled">Enabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="w-full xl:w-auto" disabled={isPending}>
                    Save reminders
                  </Button>
                </div>
              </form>
            </div>
            <div className="rounded-[28px] border border-border/60 bg-background/70 p-5">
              <div className="flex flex-col gap-5">
                <div>
                  <p className="font-semibold">Export workspace data</p>
                  <p className="mt-1 text-sm text-muted-foreground">Download each dataset as CSV.</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {EXPORT_DATASETS.map((dataset) => (
                    <div key={dataset.value} className="rounded-2xl border border-border/60 bg-secondary/20 p-4">
                      <p className="font-medium">{dataset.label}</p>
                      <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                        <a href={`/api/export/csv?dataset=${dataset.value}`}>
                          <Download className="size-4" />
                          Export {dataset.label}
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-[28px] border border-border/60 bg-background/70 p-5">
              <div className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">Import transactions</p>
                    <p className="mt-1 text-sm text-muted-foreground">Use the Spendly CSV columns.</p>
                  </div>
                  <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={!importFile || isPending} onClick={handleImport}>
                    <Upload className="size-4" />
                    Import CSV
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transaction-import">CSV file</Label>
                  <Input
                    key={fileInputKey}
                    id="transaction-import"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                  />
                  <p className="text-xs leading-5 text-muted-foreground">Skips duplicates. Creates missing accounts and categories when safe.</p>
                </div>
                {importResult?.summary ? (
                  <div className="rounded-2xl border border-border/60 bg-secondary/30 p-4 text-sm">
                    <p className="font-semibold">{importResult.message}</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-muted-foreground">Rows processed</p>
                        <p className="font-medium">{importResult.summary.totalRows}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Imported</p>
                        <p className="font-medium">{importResult.summary.importedCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Duplicates skipped</p>
                        <p className="font-medium">{importResult.summary.duplicateCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Rows needing attention</p>
                        <p className="font-medium">{importResult.summary.errorCount}</p>
                      </div>
                    </div>
                    {importResult.summary.createdAccounts.length > 0 ? (
                      <p className="mt-3 text-xs leading-5 text-muted-foreground">
                        Created accounts: {importResult.summary.createdAccounts.join(", ")}
                      </p>
                    ) : null}
                    {importResult.summary.createdCategories.length > 0 ? (
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        Created categories: {importResult.summary.createdCategories.join(", ")}
                      </p>
                    ) : null}
                    {importResult.summary.errors.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sample issues</p>
                        <div className="space-y-1 text-xs leading-5 text-muted-foreground">
                          {importResult.summary.errors.slice(0, 5).map((issue) => (
                            <p key={`${issue.row}-${issue.message}`}>
                              Row {issue.row}: {issue.message}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="rounded-[28px] border border-border/60 bg-background/70 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">Password security</p>
                  <p className="mt-1 text-sm text-muted-foreground">Reset from {user.email ?? "your email"}.</p>
                </div>
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href={user.email ? `/forgot-password?email=${encodeURIComponent(user.email)}` : "/forgot-password"}>
                    <KeyRound className="size-4" />
                    Change password
                  </Link>
                </Button>
              </div>
            </div>
            <div className="rounded-[28px] border border-border/60 bg-background/70 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">Demo workspace</p>
                  <p className="mt-1 text-sm text-muted-foreground">Sample transactions, budgets, goals, and recurring items.</p>
                </div>
                <DemoWorkspaceButton variant="outline" disabled={!canLoadDemoData} />
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                {canLoadDemoData
                  ? "Available while the workspace is still empty."
                  : "Locked because this workspace already has finance data."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Custom categories</CardTitle>
            <CardDescription className="hidden sm:block">Add custom income and expense labels.</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Add category
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>{editingCategory ? "Edit custom category" : "Create custom category"}</DialogTitle>
                <DialogDescription>Choose a label, type, color, and icon.</DialogDescription>
              </DialogHeader>
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={categoryForm.handleSubmit(submitCategory)}>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Name</Label>
                  <Input placeholder="Pet care" {...categoryForm.register("name")} />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={categoryForm.watch("type")} onValueChange={(value) => categoryForm.setValue("type", value as CategoryValues["type"])}>
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
                  <Label>Color</Label>
                  <Select value={categoryForm.watch("color")} onValueChange={(value) => categoryForm.setValue("color", value, { shouldValidate: true })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_COLOR_PALETTE.map((color) => (
                        <SelectItem key={color} value={color}>
                          {color}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Icon</Label>
                  <Select value={categoryForm.watch("icon")} onValueChange={(value) => categoryForm.setValue("icon", value, { shouldValidate: true })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(CATEGORY_ICON_MAP).map((icon) => (
                        <SelectItem key={icon} value={icon}>
                          {icon}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter className="sm:col-span-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    {editingCategory ? "Save changes" : "Save category"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {customCategories.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {customCategories.map((category) => (
                <div key={category.id} className="rounded-[28px] border border-border/60 bg-background/70 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl p-3" style={{ backgroundColor: `${category.color}20`, color: category.color }}>
                        <CategoryIcon icon={category.icon} className="size-5" />
                      </div>
                      <div>
                        <p className="font-semibold">{category.name}</p>
                        <p className="text-sm text-muted-foreground">{category.type}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" onClick={() => openEdit(category)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => setDeleteTarget(category)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Palette}
              title="No custom categories yet"
              description="Default categories are ready. Add custom ones when you need more detail."
              actionLabel="Add category"
              onAction={openCreate}
            />
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(value) => {
          if (!value) setDeleteTarget(null)
        }}
        title="Delete category?"
        description="Custom categories can be removed, but default seeded categories remain protected."
        confirmLabel="Delete category"
        pending={isPending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
