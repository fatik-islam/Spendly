"use server"

import { revalidatePath } from "next/cache"

import { requireCurrentUser } from "@/lib/auth"
import { getErrorMessage } from "@/lib/errors"
import { createInsforgeServerClient } from "@/lib/insforge/server"

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

function revalidateDemoPaths() {
  for (const path of PATHS_TO_REVALIDATE) {
    revalidatePath(path)
  }
}

export async function loadDemoWorkspace(): Promise<ActionResult> {
  await requireCurrentUser()

  try {
    const client = await createInsforgeServerClient()
    const { data, error } = await client.database.rpc("seed_spendly_demo_workspace")

    if (error) {
      throw error
    }

    const transactions = typeof data?.transactions === "number" ? data.transactions : 13

    revalidateDemoPaths()
    return {
      ok: true,
      message: `Demo workspace loaded with ${transactions} transactions.`
    }
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error, "Failed to load the demo workspace.")
    }
  }
}
