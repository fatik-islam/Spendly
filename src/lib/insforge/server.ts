import { cookies } from "next/headers"
import { createServerClient, refreshAuth } from "@insforge/sdk/ssr"

import { isJwtExpiredOrExpiring } from "@/lib/jwt"

export async function createInsforgeServerClient() {
  const cookieStore = await cookies()
  const cookieAccessToken = cookieStore.get("insforge_access_token")?.value
  let accessToken = cookieAccessToken

  if (!accessToken || isJwtExpiredOrExpiring(accessToken)) {
    const refreshed = await refreshAuth({
      cookies: cookieStore
    })

    if (refreshed.accessToken) {
      accessToken = refreshed.accessToken
    }
  }

  return createServerClient({
    cookies: cookieStore,
    ...(accessToken ? { accessToken } : {})
  })
}
