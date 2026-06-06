"use client"

import { useState, useTransition } from "react"
import { FlaskConical, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { loadDemoWorkspace } from "@/actions/demo"
import { ConfirmDialog } from "@/components/spendly/confirm-dialog"
import { Button, type ButtonProps } from "@/components/ui/button"

export function DemoWorkspaceButton({
  disabled,
  label = "Load demo workspace",
  confirmLabel = "Load demo workspace",
  ...buttonProps
}: Omit<ButtonProps, "onClick" | "children"> & {
  disabled?: boolean
  label?: string
  confirmLabel?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await loadDemoWorkspace()
      if (!result.ok) {
        toast.error(result.message)
        return
      }

      toast.success(result.message)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button {...buttonProps} disabled={disabled || isPending} onClick={() => setOpen(true)}>
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}
        {label}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Load demo workspace?"
        description="This seeds a polished sample ledger, budgets, goals, and recurring items. It only works when the workspace is still empty."
        confirmLabel={confirmLabel}
        pending={isPending}
        onConfirm={handleConfirm}
      />
    </>
  )
}
