import { type AuthCookieSettings, type CookieOptions, type CookieStore, type CookieWriter } from "@insforge/sdk/ssr"

export const REMEMBER_ME_COOKIE = "spendly_remember_me"
const REMEMBER_ME_MAX_AGE_SECONDS = 60 * 60 * 24 * 365
type CookieStoreValue = string | { value?: string | null } | undefined | null
type MutableRequestCookieTarget = {
  get(name: string): CookieStoreValue
  set(name: string, value: string): unknown
  delete(name: string): unknown
}

function cookieStoreValueToString(value: CookieStoreValue) {
  if (typeof value === "string") {
    return value
  }

  if (value && typeof value === "object" && "value" in value && typeof value.value === "string") {
    return value.value
  }

  return undefined
}

function parseCookieHeader(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return undefined
  }

  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${escapedName}=([^;]*)`))

  return match ? decodeURIComponent(match[1] ?? "") : undefined
}

export function resolveRememberMePreference(value: string | undefined) {
  return value !== "0"
}

export function getRememberMeFromCookieStore(cookies: { get(name: string): CookieStoreValue }) {
  return resolveRememberMePreference(cookieStoreValueToString(cookies.get(REMEMBER_ME_COOKIE)))
}

export function getRememberMeFromCookieHeader(cookieHeader: string | null) {
  return resolveRememberMePreference(parseCookieHeader(cookieHeader, REMEMBER_ME_COOKIE))
}

export function getAuthCookieSettings(rememberMe: boolean): AuthCookieSettings {
  if (rememberMe) {
    return {}
  }

  return {
    options: {
      accessToken: {
        expires: undefined,
        maxAge: undefined
      },
      refreshToken: {
        expires: undefined,
        maxAge: undefined
      }
    }
  }
}

export function createMiddlewareRequestCookieStore(target: MutableRequestCookieTarget, onChange?: () => void): CookieStore {
  return {
    get(name) {
      return cookieStoreValueToString(target.get(name))
    },
    set(nameOrOptions: string | ({ name: string; value: string } & CookieOptions), value?: string, options?: CookieOptions) {
      const cookieName = typeof nameOrOptions === "string" ? nameOrOptions : nameOrOptions.name
      const cookieValue = typeof nameOrOptions === "string" ? value ?? "" : nameOrOptions.value
      const cookieOptions: CookieOptions | undefined = typeof nameOrOptions === "string" ? options : nameOrOptions
      const shouldDelete =
        cookieValue === "" &&
        (cookieOptions?.maxAge === 0 ||
          (cookieOptions?.expires instanceof Date && cookieOptions.expires.getTime() <= Date.now()))

      if (shouldDelete) {
        target.delete(cookieName)
        onChange?.()
        return undefined
      }

      target.set(cookieName, cookieValue)
      onChange?.()
      return undefined
    },
    delete(nameOrOptions: string | ({ name: string } & CookieOptions)) {
      target.delete(typeof nameOrOptions === "string" ? nameOrOptions : nameOrOptions.name)
      onChange?.()
      return undefined
    }
  } as CookieStore
}

export function setRememberMeCookie(cookies: CookieWriter, rememberMe: boolean, secure: boolean) {
  cookies.set?.(REMEMBER_ME_COOKIE, rememberMe ? "1" : "0", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure,
    ...(rememberMe ? { maxAge: REMEMBER_ME_MAX_AGE_SECONDS } : {})
  })
}

export function clearRememberMeCookie(cookies: CookieWriter) {
  cookies.delete?.(REMEMBER_ME_COOKIE)
}
