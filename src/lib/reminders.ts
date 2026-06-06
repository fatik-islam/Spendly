import { createInsforgeServerClient } from "@/lib/insforge/server"
import { type ReminderCenterData, type RecurringReminder } from "@/lib/types"

export async function syncRecurringRemindersForUser(userId: string) {
  const client = await createInsforgeServerClient()
  const { error } = await client.database.rpc("generate_recurring_reminders", {
    p_target_user_id: userId
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function getReminderCenterData(limit = 8): Promise<ReminderCenterData> {
  const client = await createInsforgeServerClient()
  const { data, error } = await client.database
    .from("recurring_reminders")
    .select()
    .is("dismissed_at", null)
    .order("due_date")
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const items = ((data ?? []) as RecurringReminder[]).sort((left, right) => {
    const unreadDelta = Number(Boolean(left.read_at)) - Number(Boolean(right.read_at))
    if (unreadDelta !== 0) {
      return unreadDelta
    }

    const dueDelta = left.due_date.localeCompare(right.due_date)
    if (dueDelta !== 0) {
      return dueDelta
    }

    return right.created_at.localeCompare(left.created_at)
  })

  return {
    unreadCount: items.filter((item) => !item.read_at).length,
    overdueCount: items.filter((item) => item.kind === "overdue" && !item.read_at).length,
    upcomingCount: items.filter((item) => item.kind === "upcoming" && !item.read_at).length,
    items: items.slice(0, limit)
  }
}
