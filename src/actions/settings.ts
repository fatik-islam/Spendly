"use server"

import { revalidatePath } from "next/cache"

import { requireCurrentUser } from "@/lib/auth"
import { getErrorMessage } from "@/lib/errors"
import { createInsforgeServerClient } from "@/lib/insforge/server"
import { profileSchema } from "@/lib/validation/settings"

interface ActionResult {
  ok: boolean
  message: string
}

export async function updateProfile(input: unknown): Promise<ActionResult> {
  const user = await requireCurrentUser()
  const parsed = profileSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid profile details." }
  }

  try {
    const client = await createInsforgeServerClient()
    const { error } = await client.database
      .from("profiles")
      .update({
        full_name: parsed.data.fullName,
        currency: parsed.data.currency
      })
      .eq("user_id", user.id)

    if (error) {
      throw error
    }

    revalidatePath("/dashboard")
    revalidatePath("/settings")
    revalidatePath("/transactions")
    revalidatePath("/accounts")
    revalidatePath("/budgets")
    revalidatePath("/goals")
    revalidatePath("/recurring")
    revalidatePath("/insights")

    return { ok: true, message: "Profile updated." }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error, "Failed to update the profile.") }
  }
}
