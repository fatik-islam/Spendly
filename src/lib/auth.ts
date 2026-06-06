import { redirect } from "next/navigation"

import { createInsforgeServerClient } from "@/lib/insforge/server"
import { type AuthUser } from "@/lib/types"

export type AuthMethod = "code" | "link"

export interface PublicAuthConfig {
  requireEmailVerification: boolean
  verifyEmailMethod: AuthMethod
  resetPasswordMethod: AuthMethod
  passwordMinLength: number
  oAuthProviders: string[]
}

function normalizeUser(input: Record<string, unknown>) {
  const metadata = typeof input.user_metadata === "object" && input.user_metadata ? (input.user_metadata as Record<string, unknown>) : {}

  return {
    id: String(input.id),
    email: typeof input.email === "string" ? input.email : null,
    name: typeof metadata.name === "string" ? metadata.name : typeof input.name === "string" ? input.name : null
  } satisfies AuthUser
}

export async function getCurrentUser() {
  const client = await createInsforgeServerClient()
  const { data, error } = await client.auth.getCurrentUser()

  if (error || !data?.user || typeof data.user !== "object") {
    return null
  }

  return normalizeUser(data.user as Record<string, unknown>)
}

export async function getPublicAuthConfig(): Promise<PublicAuthConfig> {
  const client = await createInsforgeServerClient()
  const { data } = await client.auth.getPublicAuthConfig()

  return {
    requireEmailVerification: data?.requireEmailVerification ?? true,
    verifyEmailMethod: data?.verifyEmailMethod === "link" ? "link" : "code",
    resetPasswordMethod: data?.resetPasswordMethod === "link" ? "link" : "code",
    passwordMinLength: typeof data?.passwordMinLength === "number" ? data.passwordMinLength : 6,
    oAuthProviders: data?.oAuthProviders ?? []
  }
}

export async function requireCurrentUser() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  return user
}
