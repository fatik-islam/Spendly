import { z } from "zod"

import { CURRENCY_OPTIONS } from "@/lib/constants"

export const profileSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters."),
  currency: z.enum(CURRENCY_OPTIONS)
})

export const reminderPreferencesSchema = z.object({
  reminderDaysBefore: z.coerce.number().int().min(0, "Lead time cannot be negative.").max(30, "Lead time must be 30 days or less."),
  reminderInAppEnabled: z.boolean().default(true),
  reminderEmailEnabled: z.boolean().default(false)
}).refine((values) => values.reminderInAppEnabled || !values.reminderEmailEnabled, {
  message: "Enable in-app reminders before turning on email reminders.",
  path: ["reminderEmailEnabled"]
})
