import { describe, expect, it } from "vitest"

import {
  REMEMBER_ME_COOKIE,
  createMiddlewareRequestCookieStore,
  getAuthCookieSettings,
  getRememberMeFromCookieHeader,
  getRememberMeFromCookieStore,
  resolveRememberMePreference
} from "@/lib/auth-cookies"

describe("auth remember-me cookies", () => {
  it("defaults missing remember-me state to persistent sessions", () => {
    expect(resolveRememberMePreference(undefined)).toBe(true)
    expect(getRememberMeFromCookieHeader(null)).toBe(true)
    expect(
      getRememberMeFromCookieStore({
        get() {
          return undefined
        }
      })
    ).toBe(true)
  })

  it("treats explicit 0 remember-me value as session-only", () => {
    expect(resolveRememberMePreference("0")).toBe(false)
    expect(getRememberMeFromCookieHeader(`${REMEMBER_ME_COOKIE}=0`)).toBe(false)
    expect(
      getRememberMeFromCookieStore({
        get() {
          return "0"
        }
      })
    ).toBe(false)
  })

  it("removes cookie expiry overrides when remember-me is disabled", () => {
    expect(getAuthCookieSettings(true)).toEqual({})
    expect(getAuthCookieSettings(false)).toEqual({
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
    })
  })

  it("writes refreshed auth cookies back into the current request cookie store", () => {
    const values = new Map<string, string>([["insforge_access_token", "stale-token"]])
    const store = createMiddlewareRequestCookieStore({
      get(name) {
        return values.get(name)
      },
      set(name, value) {
        values.set(name, value)
      },
      delete(name) {
        values.delete(name)
      }
    })

    store.set?.("insforge_access_token", "fresh-token", {
      expires: new Date(Date.now() + 60_000)
    })

    expect(values.get("insforge_access_token")).toBe("fresh-token")
    expect(store.get("insforge_access_token")).toBe("fresh-token")
  })

  it("removes request cookies when the sdk clears an expired session", () => {
    const values = new Map<string, string>([
      ["insforge_access_token", "stale-token"],
      ["insforge_refresh_token", "refresh-token"]
    ])
    const store = createMiddlewareRequestCookieStore({
      get(name) {
        return values.get(name)
      },
      set(name, value) {
        values.set(name, value)
      },
      delete(name) {
        values.delete(name)
      }
    })

    store.set?.("insforge_access_token", "", {
      expires: new Date(0),
      maxAge: 0
    })
    store.delete?.("insforge_refresh_token")

    expect(values.has("insforge_access_token")).toBe(false)
    expect(values.has("insforge_refresh_token")).toBe(false)
  })
})
