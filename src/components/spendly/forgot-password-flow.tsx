"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Loader2, MailCheck } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { AuthCard } from "@/components/spendly/auth-card"
import { PasswordInput } from "@/components/spendly/password-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { type AuthMethod } from "@/lib/auth"
import {
  createResetPasswordCodeSchema,
  requestPasswordResetSchema
} from "@/lib/validation/auth"

type RequestResetValues = z.infer<typeof requestPasswordResetSchema>
type ResetCodeValues = z.infer<ReturnType<typeof createResetPasswordCodeSchema>>

export function ForgotPasswordFlow({
  prefilledEmail,
  passwordMinLength,
  resetPasswordMethod
}: {
  prefilledEmail?: string
  passwordMinLength: number
  resetPasswordMethod: AuthMethod
}) {
  const router = useRouter()
  const [step, setStep] = useState<"request" | "confirm" | "email-sent">("request")
  const [submittedEmail, setSubmittedEmail] = useState(prefilledEmail ?? "")
  const [isPending, startTransition] = useTransition()
  const resetCodeSchema = createResetPasswordCodeSchema(passwordMinLength)
  const requestForm = useForm<RequestResetValues>({
    resolver: zodResolver(requestPasswordResetSchema),
    defaultValues: {
      email: prefilledEmail ?? ""
    }
  })
  const resetCodeForm = useForm<ResetCodeValues>({
    resolver: zodResolver(resetCodeSchema),
    defaultValues: {
      email: prefilledEmail ?? "",
      code: "",
      newPassword: "",
      confirmPassword: ""
    }
  })

  useEffect(() => {
    if (!prefilledEmail) return

    requestForm.setValue("email", prefilledEmail)
    resetCodeForm.setValue("email", prefilledEmail)
  }, [prefilledEmail, requestForm, resetCodeForm])

  const requestResetEmail = (values: RequestResetValues) => {
    startTransition(async () => {
      const response = await fetch("/api/auth/send-reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(values)
      })

      const payload = (await response.json()) as { message?: string; email?: string }

      if (!response.ok) {
        toast.error(payload.message ?? "Failed to start password reset.")
        return
      }

      const email = payload.email ?? values.email
      setSubmittedEmail(email)
      resetCodeForm.setValue("email", email)

      if (resetPasswordMethod === "link") {
        setStep("email-sent")
        toast.success("Check your email for the reset link.")
        return
      }

      setStep("confirm")
      toast.success("Check your email and enter the 6-digit reset code.")
    })
  }

  const resendResetEmail = () => {
    const email = submittedEmail || requestForm.getValues("email")
    if (!email) {
      toast.error("Enter your email first.")
      return
    }

    requestResetEmail({ email })
  }

  const submitResetCode = (values: ResetCodeValues) => {
    startTransition(async () => {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: values.email,
          code: values.code,
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
      title={step === "confirm" ? "Enter your reset code" : step === "email-sent" ? "Check your inbox" : "Reset your password"}
      description={
        step === "confirm"
          ? `Enter the 6-digit code sent to ${submittedEmail}.`
          : step === "email-sent"
            ? `We sent a reset email to ${submittedEmail}. Open the link there to continue.`
            : "Reset your password."
      }
      footer={
        <p className="text-sm text-muted-foreground">
          Remember your password?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      }
    >
      {step === "request" ? (
        <form className="space-y-5" onSubmit={requestForm.handleSubmit(requestResetEmail)}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...requestForm.register("email")} />
            {requestForm.formState.errors.email ? <p className="text-sm text-destructive">{requestForm.formState.errors.email.message}</p> : null}
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" /> : null}
            {resetPasswordMethod === "link" ? "Send reset link" : "Send reset code"}
          </Button>
        </form>
      ) : step === "confirm" ? (
        <div className="space-y-5">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            onClick={() => setStep("request")}
          >
            <ArrowLeft className="size-4" />
            Use a different email
          </button>
          <form className="space-y-5" onSubmit={resetCodeForm.handleSubmit(submitResetCode)}>
            <input type="hidden" {...resetCodeForm.register("email")} value={submittedEmail} />
            <div className="space-y-2">
              <Label htmlFor="code">Reset code</Label>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                {...resetCodeForm.register("code")}
              />
              {resetCodeForm.formState.errors.code ? <p className="text-sm text-destructive">{resetCodeForm.formState.errors.code.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <PasswordInput
                id="newPassword"
                autoComplete="new-password"
                placeholder={`At least ${passwordMinLength} characters`}
                {...resetCodeForm.register("newPassword")}
              />
              {resetCodeForm.formState.errors.newPassword ? (
                <p className="text-sm text-destructive">{resetCodeForm.formState.errors.newPassword.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                placeholder="Repeat your new password"
                {...resetCodeForm.register("confirmPassword")}
              />
              {resetCodeForm.formState.errors.confirmPassword ? (
                <p className="text-sm text-destructive">{resetCodeForm.formState.errors.confirmPassword.message}</p>
              ) : null}
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" /> : null}
              Update password
            </Button>
            <Button type="button" variant="ghost" className="w-full" disabled={isPending} onClick={resendResetEmail}>
              Resend code
            </Button>
          </form>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-3xl border border-border/60 bg-background/70 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <MailCheck className="size-5" />
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">Password reset email sent</p>
                <p className="leading-6">
                  Use the email sent to <span className="font-medium text-foreground">{submittedEmail}</span> to continue the reset flow.
                </p>
              </div>
            </div>
          </div>
          <Button type="button" className="w-full" onClick={() => router.push("/login")}>
            Return to sign in
          </Button>
          <Button type="button" variant="ghost" className="w-full" disabled={isPending} onClick={resendResetEmail}>
            Resend email
          </Button>
        </div>
      )}
    </AuthCard>
  )
}
