import { NextResponse } from "next/server"
import { createServerClient, setAuthCookies } from "@insforge/sdk/ssr"

import { setRememberMeCookie } from "@/lib/auth-cookies"
import { createSignUpSchema } from "@/lib/validation/auth"

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
}

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = createSignUpSchema().safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_INPUT",
        message: parsed.error.issues[0]?.message ?? "Invalid sign up payload."
      },
      { status: 400 }
    )
  }

  const client = createServerClient()
  const { data, error } = await client.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    name: parsed.data.fullName,
    redirectTo: `${getAppUrl()}/login`
  })

  if (error) {
    return NextResponse.json(
      {
        error: error.error ?? "AUTH_SIGN_UP_FAILED",
        statusCode: error.statusCode ?? 400,
        message: error.message
      },
      { status: error.statusCode ?? 400 }
    )
  }

  if (data?.accessToken) {
    const response = NextResponse.json({
      status: "authenticated"
    })

    setAuthCookies(response.cookies, {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken
    })
    setRememberMeCookie(response.cookies, true, new URL(request.url).protocol === "https:")

    return response
  }

  return NextResponse.json({
    status: "verify",
    email: parsed.data.email
  })
}
