import { NextResponse } from "next/server"
import { createServerClient } from "@insforge/sdk/ssr"

import { requestPasswordResetSchema } from "@/lib/validation/auth"

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
}

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = requestPasswordResetSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_INPUT",
        message: parsed.error.issues[0]?.message ?? "Invalid reset password payload."
      },
      { status: 400 }
    )
  }

  const client = createServerClient()
  const config = await client.auth.getPublicAuthConfig()
  const { error } = await client.auth.sendResetPasswordEmail(
    config.data?.resetPasswordMethod === "link"
      ? {
          email: parsed.data.email,
          redirectTo: `${getAppUrl()}/reset-password`
        }
      : {
          email: parsed.data.email
        }
  )

  if (error) {
    return NextResponse.json(
      {
        error: error.error ?? "RESET_EMAIL_FAILED",
        statusCode: error.statusCode ?? 400,
        message: error.message
      },
      { status: error.statusCode ?? 400 }
    )
  }

  return NextResponse.json({
    ok: true,
    email: parsed.data.email
  })
}
