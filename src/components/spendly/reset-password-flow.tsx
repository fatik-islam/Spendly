"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, ShieldCheck } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { AuthCard } from "@/components/spendly/auth-card"
import { PasswordInput } from "@/components/spendly/password-input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { createResetPasswordTokenSchema } from "@/lib/validation/auth"

type ResetTokenValues = z.infer<ReturnType<typeof createResetPasswordTokenSchema>>

export function ResetPasswordFlow({
  token,
  status,
  error,
  passwordMinLength
}: {
  token?: string
  status?: string
  error?: string
  passwordMinLength: number
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const resetSchema = createResetPasswordTokenSchema(passwordMinLength)
  const form = useForm<ResetTokenValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      otp: token ?? "",
      newPassword: "",
      confirmPassword: ""
    }
  })

  const ready = status === "ready" && Boolean(token)

  const onSubmit = (values: ResetTokenValues) => {
    startTransition(async () => {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          otp: values.otp,
          newPassword: values.newPassword
        })
      })

      const payload = (await response.json()) as { message?: string }

      if (!response.ok) {
        toast.error(payload.message ?? "Failed to reset your password.")
        return
      }

      toast.success(payload.message ?? "Password updated.")
      router.push("/login?insforge_status=success&insforge_type=reset_password")
      router.refresh()
    })
  }

  return (
    <AuthCard
      title={ready ? "Choose a new password" : "Reset link required"}
      description={
        ready
          ? "Set a new password."
          : "Open this page from a valid reset email."
      }
      footer={
        <p className="text-sm text-muted-foreground">
          Need a new reset email?{" "}
          <Link href="/forgot-password" className="font-semibold text-primary hover:underline">
            Request another one
          </Link>
        </p>
      }
    >
      {ready ? (
        <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
          <input type="hidden" {...form.register("otp")} value={token} />
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              placeholder={`At least ${passwordMinLength} characters`}
              {...form.register("newPassword")}
            />
            {form.formState.errors.newPassword ? <p className="text-sm text-destructive">{form.formState.errors.newPassword.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              placeholder="Repeat your new password"
              {...form.register("confirmPassword")}
            />
            {form.formState.errors.confirmPassword ? (
              <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
            ) : null}
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" /> : null}
            Save new password
          </Button>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="rounded-3xl border border-border/60 bg-background/70 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <ShieldCheck className="size-5" />
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">Reset link not ready</p>
                <p className="leading-6">
                  {error ?? "Open the latest password reset email from Spendly to continue."}
                </p>
              </div>
            </div>
          </div>
          <Button asChild className="w-full">
            <Link href="/forgot-password">Request a new reset email</Link>
          </Button>
        </div>
      )}
    </AuthCard>
  )
}
