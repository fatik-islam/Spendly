import { NextResponse } from "next/server"
import { createServerClient } from "@insforge/sdk/ssr"

import { verifyEmailSchema } from "@/lib/validation/auth"

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
}

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = verifyEmailSchema.pick({ email: true }).safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_INPUT",
        message: parsed.error.issues[0]?.message ?? "Invalid email payload."
      },
      { status: 400 }
    )
  }

  const client = createServerClient()
  const { error } = await client.auth.resendVerificationEmail({
    email: parsed.data.email,
    redirectTo: `${getAppUrl()}/login`
  })

  if (error) {
    return NextResponse.json(
      {
        error: error.error ?? "RESEND_FAILED",
        statusCode: error.statusCode ?? 400,
        message: error.message
      },
      { status: error.statusCode ?? 400 }
    )
  }

  return NextResponse.json({ ok: true })
}
