import { describe, expect, it } from "vitest"

import { profileSchema, reminderPreferencesSchema } from "@/lib/validation/settings"

describe("profileSchema", () => {
  it("accepts valid profile updates", () => {
    const result = profileSchema.safeParse({
      fullName: "Syed Fatik Islam",
      currency: "PKR"
    })

    expect(result.success).toBe(true)
  })
})

describe("reminderPreferencesSchema", () => {
  it("accepts in-app reminders with optional email delivery", () => {
    const result = reminderPreferencesSchema.safeParse({
      reminderDaysBefore: 3,
      reminderInAppEnabled: true,
      reminderEmailEnabled: true
    })

    expect(result.success).toBe(true)
  })

  it("rejects email reminders when in-app reminders are disabled", () => {
    const result = reminderPreferencesSchema.safeParse({
      reminderDaysBefore: 5,
      reminderInAppEnabled: false,
      reminderEmailEnabled: true
    })

    expect(result.success).toBe(false)

    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Enable in-app reminders before turning on email reminders.")
    }
  })

  it("rejects lead times above the supported maximum", () => {
    const result = reminderPreferencesSchema.safeParse({
      reminderDaysBefore: 45,
      reminderInAppEnabled: true,
      reminderEmailEnabled: false
    })

    expect(result.success).toBe(false)
  })
})
