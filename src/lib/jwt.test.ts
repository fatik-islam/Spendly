import { describe, expect, it } from "vitest"

import { getJwtExpiration, isJwtExpiredOrExpiring } from "@/lib/jwt"

function createUnsignedToken(exp?: number) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url")
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(exp ? { exp } : {})}.signature`
}

describe("jwt helpers", () => {
  it("reads the expiration from a token payload", () => {
    const exp = Math.floor(Date.now() / 1000) + 300

    expect(getJwtExpiration(createUnsignedToken(exp))).toBe(exp)
  })

  it("treats malformed or exp-less tokens as expired", () => {
    expect(getJwtExpiration("not-a-jwt")).toBeNull()
    expect(isJwtExpiredOrExpiring("not-a-jwt")).toBe(true)
    expect(isJwtExpiredOrExpiring(createUnsignedToken())).toBe(true)
  })

  it("flags tokens that are within the refresh leeway", () => {
    const futureExp = Math.floor(Date.now() / 1000) + 300
    const nearExp = Math.floor(Date.now() / 1000) + 5

    expect(isJwtExpiredOrExpiring(createUnsignedToken(futureExp), 30)).toBe(false)
    expect(isJwtExpiredOrExpiring(createUnsignedToken(nearExp), 30)).toBe(true)
  })
})
