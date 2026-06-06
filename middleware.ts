import { NextResponse, type NextRequest } from "next/server"
import { ResponseCookies } from "next/dist/server/web/spec-extension/cookies"
import { type CookieStore, updateSession } from "@insforge/sdk/ssr"

import { createMiddlewareRequestCookieStore, getAuthCookieSettings, getRememberMeFromCookieStore } from "@/lib/auth-cookies"

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  const syncRequestCookieHeader = () => {
    const serializedCookies = request.cookies.toString()

    if (serializedCookies) {
      requestHeaders.set("cookie", serializedCookies)
      return
    }

    requestHeaders.delete("cookie")
  }
  const requestCookies: CookieStore = createMiddlewareRequestCookieStore(request.cookies, syncRequestCookieHeader)
  const stagedResponseCookies = new ResponseCookies(new Headers())
  const rememberMe = getRememberMeFromCookieStore(request.cookies)

  syncRequestCookieHeader()

  await updateSession({
    ...getAuthCookieSettings(rememberMe),
    requestCookies,
    responseCookies: stagedResponseCookies as unknown as CookieStore
  })

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  })

  for (const cookie of stagedResponseCookies.getAll()) {
    response.cookies.set(cookie)
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
}
