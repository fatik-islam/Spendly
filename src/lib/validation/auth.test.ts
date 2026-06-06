import { describe, expect, it } from "vitest"

import { createSignInSchema } from "@/lib/validation/auth"

describe("createSignInSchema", () => {
  it("defaults rememberMe to false when omitted", () => {
    const result = createSignInSchema().safeParse({
      email: "user@example.com",
      password: "Test123!"
    })

    expect(result.success).toBe(true)

    if (result.success) {
      expect(result.data.rememberMe).toBe(false)
    }
  })

  it("accepts an explicit rememberMe flag", () => {
    const result = createSignInSchema().safeParse({
      email: "user@example.com",
      password: "Test123!",
      rememberMe: true
    })

    expect(result.success).toBe(true)

    if (result.success) {
      expect(result.data.rememberMe).toBe(true)
    }
  })
})
