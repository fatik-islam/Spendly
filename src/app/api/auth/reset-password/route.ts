import { NextResponse } from "next/server"
import { createServerClient } from "@insforge/sdk/ssr"

import { submitResetPasswordSchema } from "@/lib/validation/auth"

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = submitResetPasswordSchema.safeParse(body)

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

  let otp = parsed.data.otp

  if (!otp) {
    const exchange = await client.auth.exchangeResetPasswordToken({
      email: parsed.data.email!,
      code: parsed.data.code!
    })

    if (exchange.error || !exchange.data?.token) {
      return NextResponse.json(
        {
          error: exchange.error?.error ?? "RESET_CODE_FAILED",
          statusCode: exchange.error?.statusCode ?? 400,
          message: exchange.error?.message ?? "Failed to verify the reset code."
        },
        { status: exchange.error?.statusCode ?? 400 }
      )
    }

    otp = exchange.data.token
  }

  const { data, error } = await client.auth.resetPassword({
    newPassword: parsed.data.newPassword,
    otp
  })

  if (error) {
    return NextResponse.json(
      {
        error: error.error ?? "RESET_PASSWORD_FAILED",
        statusCode: error.statusCode ?? 400,
        message: error.message
      },
      { status: error.statusCode ?? 400 }
    )
  }

  return NextResponse.json({
    ok: true,
    message: data?.message ?? "Password updated."
  })
}
