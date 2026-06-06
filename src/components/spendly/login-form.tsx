"use client"

import Link from "next/link"
import { useEffect } from "react"
import { toast } from "sonner"

import { AuthCard } from "@/components/spendly/auth-card"
import { PasswordInput } from "@/components/spendly/password-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm({
  authStatus,
  authType,
  authError,
  passwordMinLength
}: {
  authStatus?: string
  authType?: string
  authError?: string
  passwordMinLength: number
}) {
  useEffect(() => {
    if (authType === "verify_email" && authStatus === "success") {
      toast.success("Email verified. You can sign in now.")
    }

    if (authType === "reset_password" && authStatus === "success") {
      toast.success("Password updated. Sign in with your new password.")
    }

    if (authError) {
      toast.error(authError)
    }
  }, [authError, authStatus, authType])

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to your workspace."
      footer={
        <p className="text-sm text-muted-foreground">
          New to Spendly?{" "}
          <Link href="/signup" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </p>
      }
    >
      <form action="/api/auth/sign-in" autoComplete="on" className="space-y-5" method="post">
        <input type="hidden" name="redirectTo" value="/dashboard" />
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            inputMode="email"
            name="email"
            placeholder="you@example.com"
            required
            spellCheck={false}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            autoCapitalize="none"
            minLength={passwordMinLength}
            name="password"
            placeholder="••••••••"
            required
            spellCheck={false}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label htmlFor="remember-me" className="flex items-center gap-3 text-sm text-muted-foreground">
              <input
                id="remember-me"
                defaultChecked
                name="rememberMe"
                type="checkbox"
                className="size-4 rounded border border-input bg-background/70 accent-primary"
              />
              <span>Remember me on this device</span>
            </label>
            <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>
        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>
    </AuthCard>
  )
}
