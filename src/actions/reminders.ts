"use server"

import { revalidatePath } from "next/cache"

import { requireCurrentUser } from "@/lib/auth"
import { getErrorMessage } from "@/lib/errors"
import { createInsforgeServerClient } from "@/lib/insforge/server"
import { reminderPreferencesSchema } from "@/lib/validation/settings"

interface ActionResult {
  ok: boolean
  message: string
}

const PATHS_TO_REVALIDATE = [
  "/dashboard",
  "/transactions",
  "/accounts",
  "/budgets",
  "/goals",
  "/recurring",
  "/insights",
  "/settings"
] as const

function revalidateReminderPaths() {
  for (const path of PATHS_TO_REVALIDATE) {
    revalidatePath(path)
  }
}

export async function updateReminderPreferences(input: unknown): Promise<ActionResult> {
  const user = await requireCurrentUser()
  const parsed = reminderPreferencesSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid reminder preferences." }
  }

  try {
    const client = await createInsforgeServerClient()
    const { error: profileError } = await client.database
      .from("profiles")
      .update({
        reminder_days_before: parsed.data.reminderDaysBefore,
        reminder_in_app_enabled: parsed.data.reminderInAppEnabled,
        reminder_email_enabled: parsed.data.reminderEmailEnabled
      })
      .eq("user_id", user.id)

    if (profileError) {
      throw profileError
    }

    const { error: reminderDeleteError } = await client.database
      .from("recurring_reminders")
      .delete()
      .eq("user_id", user.id)
      .is("dismissed_at", null)
      .is("read_at", null)

    if (reminderDeleteError) {
      throw reminderDeleteError
    }

    if (parsed.data.reminderInAppEnabled) {
      const { error: syncError } = await client.database.rpc("generate_recurring_reminders", {
        p_target_user_id: user.id
      })

      if (syncError) {
        throw syncError
      }
    }

    revalidateReminderPaths()
    return { ok: true, message: "Reminder preferences updated." }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error, "Failed to update reminder preferences.") }
  }
}

export async function markReminderRead(reminderId: string): Promise<ActionResult> {
  const user = await requireCurrentUser()

  try {
    const client = await createInsforgeServerClient()
    const { error } = await client.database
      .from("recurring_reminders")
      .update({ read_at: new Date().toISOString() })
      .eq("id", reminderId)
      .eq("user_id", user.id)
      .is("dismissed_at", null)

    if (error) {
      throw error
    }

    revalidateReminderPaths()
    return { ok: true, message: "Reminder marked as read." }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error, "Failed to update the reminder.") }
  }
}

export async function dismissReminder(reminderId: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  const timestamp = new Date().toISOString()

  try {
    const client = await createInsforgeServerClient()
    const { error } = await client.database
      .from("recurring_reminders")
      .update({
        read_at: timestamp,
        dismissed_at: timestamp
      })
      .eq("id", reminderId)
      .eq("user_id", user.id)

    if (error) {
      throw error
    }

    revalidateReminderPaths()
    return { ok: true, message: "Reminder dismissed." }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error, "Failed to dismiss the reminder.") }
  }
}
