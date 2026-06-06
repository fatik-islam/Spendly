import { NextResponse } from "next/server"
import { createServerClient, setAuthCookies } from "@insforge/sdk/ssr"

import { getAuthCookieSettings, setRememberMeCookie } from "@/lib/auth-cookies"
import { createSignInSchema } from "@/lib/validation/auth"

function getSafeRedirectPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard"
  }

  return value
}

function getSubmittedIdentifier(body: FormData | Record<string, unknown>) {
  if (body instanceof FormData) {
    if (typeof body.get("username") === "string" && body.get("username")) {
      return body.get("username")
    }

    return typeof body.get("email") === "string" ? body.get("email") : ""
  }

  if (typeof body.username === "string" && body.username) {
    return body.username
  }

  return typeof body.email === "string" ? body.email : ""
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? ""
  const expectsFormRedirect =
    contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")

  const body = expectsFormRedirect
    ? await request.formData()
    : await request.json()

  const redirectTo = expectsFormRedirect
    ? getSafeRedirectPath(typeof body.get("redirectTo") === "string" ? body.get("redirectTo") : undefined)
    : "/dashboard"

  const parsed = createSignInSchema().safeParse(
    expectsFormRedirect
      ? {
          email: getSubmittedIdentifier(body),
          password: typeof body.get("password") === "string" ? body.get("password") : "",
          rememberMe: body.get("rememberMe") === "on"
        }
      : {
          ...body,
          email: getSubmittedIdentifier(body)
        }
  )

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid sign in payload."

    if (expectsFormRedirect) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("insforge_error", message)
      return NextResponse.redirect(loginUrl, 303)
    }

    return NextResponse.json(
      {
        error: "INVALID_INPUT",
        message
      },
      { status: 400 }
    )
  }

  const client = createServerClient()
  const { data, error } = await client.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password
  })

  if (error || !data?.accessToken) {
    const message = error?.message ?? "Sign in failed."

    if (expectsFormRedirect) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("insforge_error", message)
      return NextResponse.redirect(loginUrl, 303)
    }

    return NextResponse.json(
      {
        error: error?.error ?? "AUTH_UNAUTHORIZED",
        statusCode: error?.statusCode ?? 401,
        message
      },
      { status: error?.statusCode ?? 401 }
    )
  }

  const response = expectsFormRedirect
    ? NextResponse.redirect(new URL(redirectTo, request.url), 303)
    : NextResponse.json({
        ok: true,
        user: data.user
      })
  const rememberMe = parsed.data.rememberMe
  const authCookieSettings = getAuthCookieSettings(rememberMe)
  const secure = new URL(request.url).protocol === "https:"

  setAuthCookies(
    response.cookies,
    {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken
    },
    authCookieSettings
  )
  setRememberMeCookie(response.cookies, rememberMe, secure)

  return response
}
