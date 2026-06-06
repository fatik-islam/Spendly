import { NextResponse } from "next/server"
import { createServerClient, setAuthCookies } from "@insforge/sdk/ssr"

import { setRememberMeCookie } from "@/lib/auth-cookies"
import { verifyEmailSchema } from "@/lib/validation/auth"

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = verifyEmailSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_INPUT",
        message: parsed.error.issues[0]?.message ?? "Invalid verification payload."
      },
      { status: 400 }
    )
  }

  const client = createServerClient()
  const { data, error } = await client.auth.verifyEmail({
    email: parsed.data.email,
    otp: parsed.data.otp
  })

  if (error || !data?.accessToken) {
    return NextResponse.json(
      {
        error: error?.error ?? "VERIFY_FAILED",
        statusCode: error?.statusCode ?? 400,
        message: error?.message ?? "Verification failed."
      },
      { status: error?.statusCode ?? 400 }
    )
  }

  const response = NextResponse.json({
    ok: true
  })

  setAuthCookies(response.cookies, {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken
  })
  setRememberMeCookie(response.cookies, true, new URL(request.url).protocol === "https:")

  return response
}
