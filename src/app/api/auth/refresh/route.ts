import { refreshAuth } from "@insforge/sdk/ssr"

import { getAuthCookieSettings, getRememberMeFromCookieHeader } from "@/lib/auth-cookies"

export async function POST(request: Request) {
  const rememberMe = getRememberMeFromCookieHeader(request.headers.get("cookie"))

  return (await refreshAuth({
    ...getAuthCookieSettings(rememberMe),
    request
  })).response
}
