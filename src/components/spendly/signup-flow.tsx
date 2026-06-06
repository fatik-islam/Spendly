"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { AuthCard } from "@/components/spendly/auth-card"
import { PasswordInput } from "@/components/spendly/password-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { type AuthMethod } from "@/lib/auth"
import { createSignUpSchema, verifyEmailSchema } from "@/lib/validation/auth"

type SignUpValues = z.infer<ReturnType<typeof createSignUpSchema>>
type VerifyValues = z.infer<typeof verifyEmailSchema>

export function SignupFlow({
  passwordMinLength,
  verifyEmailMethod
}: {
  passwordMinLength: number
  verifyEmailMethod: AuthMethod
}) {
  const router = useRouter()
  const [step, setStep] = useState<"signup" | "verify-code" | "verify-link">("signup")
  const [verificationEmail, setVerificationEmail] = useState("")
  const [isPending, startTransition] = useTransition()
  const signUpSchema = createSignUpSchema(passwordMinLength)
  const signUpForm = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: ""
    }
  })
  const verifyForm = useForm<VerifyValues>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: {
      email: "",
      otp: ""
    }
  })

  const handleSignUp = (values: SignUpValues) => {
    startTransition(async () => {
      const response = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(values)
      })
      const payload = (await response.json()) as {
        message?: string
        status?: "authenticated" | "verify"
        email?: string
      }

      if (!response.ok) {
        toast.error(payload.message ?? "Sign up failed.")
        return
      }

      if (payload.status === "authenticated") {
        toast.success("Account created.")
        router.push("/dashboard")
        router.refresh()
        return
      }

      const email = payload.email ?? values.email
      setVerificationEmail(email)
      if (verifyEmailMethod === "link") {
        setStep("verify-link")
        toast.success("Check your email for the verification link.")
        return
      }

      verifyForm.setValue("email", email)
      setStep("verify-code")
      toast.success("Check your email and enter the 6-digit verification code.")
    })
  }

  const handleVerify = (values: VerifyValues) => {
    startTransition(async () => {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(values)
      })
      const payload = (await response.json()) as { message?: string }

      if (!response.ok) {
        toast.error(payload.message ?? "Verification failed.")
        return
      }

      toast.success("Email verified.")
      router.push("/dashboard")
      router.refresh()
    })
  }

  const resendCode = () => {
    startTransition(async () => {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: verificationEmail })
      })

      const payload = (await response.json()) as { message?: string }

      if (!response.ok) {
        toast.error(payload.message ?? (verifyEmailMethod === "link" ? "Failed to resend the email." : "Failed to resend the code."))
        return
      }

      toast.success(verifyEmailMethod === "link" ? "Verification email resent." : "Verification code resent.")
    })
  }

  return (
    <AuthCard
      title={
        step === "signup"
          ? "Create your Spendly workspace"
          : step === "verify-link"
            ? "Check your inbox"
            : "Verify your email"
      }
      description={
        step === "signup"
          ? "Create your workspace."
          : step === "verify-link"
            ? `We sent a verification email to ${verificationEmail}. Open it, then return to sign in.`
            : `Enter the 6-digit code sent to ${verificationEmail}.`
      }
      footer={
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      {step === "signup" ? (
        <form className="space-y-5" onSubmit={signUpForm.handleSubmit(handleSignUp)}>
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" autoComplete="name" placeholder="Alex Morgan" {...signUpForm.register("fullName")} />
            {signUpForm.formState.errors.fullName ? (
              <p className="text-sm text-destructive">{signUpForm.formState.errors.fullName.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" placeholder="alex@example.com" {...signUpForm.register("email")} />
            {signUpForm.formState.errors.email ? <p className="text-sm text-destructive">{signUpForm.formState.errors.email.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              placeholder={`At least ${passwordMinLength} characters`}
              {...signUpForm.register("password")}
            />
            {signUpForm.formState.errors.password ? (
              <p className="text-sm text-destructive">{signUpForm.formState.errors.password.message}</p>
            ) : null}
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" /> : null}
            Create account
          </Button>
        </form>
      ) : step === "verify-code" ? (
        <div className="space-y-5">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            onClick={() => setStep("signup")}
          >
            <ArrowLeft className="size-4" />
            Back to sign up
          </button>
          <form className="space-y-5" onSubmit={verifyForm.handleSubmit(handleVerify)}>
            <input type="hidden" {...verifyForm.register("email")} value={verificationEmail} />
            <div className="space-y-2">
              <Label htmlFor="otp">Verification code</Label>
              <Input
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                {...verifyForm.register("otp")}
              />
              {verifyForm.formState.errors.otp ? <p className="text-sm text-destructive">{verifyForm.formState.errors.otp.message}</p> : null}
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" /> : null}
              Verify email
            </Button>
            <Button type="button" variant="ghost" className="w-full" disabled={isPending} onClick={resendCode}>
              Resend code
            </Button>
          </form>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-3xl border border-border/60 bg-background/70 p-5 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Verification link sent</p>
            <p className="mt-2 leading-6">
              Open the email we sent to <span className="font-medium text-foreground">{verificationEmail}</span>, use the verification
              link, and then return here to sign in.
            </p>
          </div>
          <Button type="button" className="w-full" variant="outline" disabled={isPending} onClick={resendCode}>
            Resend verification email
          </Button>
          <Button type="button" className="w-full" onClick={() => router.push("/login")}>
            Go to sign in
          </Button>
        </div>
      )}
    </AuthCard>
  )
}
