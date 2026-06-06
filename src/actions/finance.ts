"use server"

import { revalidatePath } from "next/cache"

import { requireCurrentUser } from "@/lib/auth"
import { getErrorMessage } from "@/lib/errors"
import { createInsforgeServerClient } from "@/lib/insforge/server"
import {
  accountSchema,
  budgetSchema,
  categorySchema,
  recurringTransactionSchema,
  savingsGoalSchema,
  transactionSchema
} from "@/lib/validation/finance"

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
]

function revalidateFinancePaths() {
  for (const path of PATHS_TO_REVALIDATE) {
    revalidatePath(path)
  }
}

export async function saveAccount(input: unknown): Promise<ActionResult> {
  const user = await requireCurrentUser()
  const parsed = accountSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid account details." }
  }

  try {
    const client = await createInsforgeServerClient()

    if (parsed.data.id) {
      const { error } = await client.database
        .from("accounts")
        .update({
          name: parsed.data.name,
          type: parsed.data.type,
          balance: parsed.data.balance,
          currency: parsed.data.currency
        })
        .eq("id", parsed.data.id)
        .eq("user_id", user.id)

      if (error) {
        throw error
      }
    } else {
      const { error } = await client.database.from("accounts").insert([
        {
          user_id: user.id,
          name: parsed.data.name,
          type: parsed.data.type,
          balance: parsed.data.balance,
          currency: parsed.data.currency
        }
      ])

      if (error) {
        throw error
      }
    }

    revalidateFinancePaths()
    return { ok: true, message: parsed.data.id ? "Account updated." : "Account created." }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error, "Failed to save the account.") }
  }
}

export async function deleteAccount(accountId: string): Promise<ActionResult> {
  const user = await requireCurrentUser()

  try {
    const client = await createInsforgeServerClient()
    const { data: transactions, error: transactionsError } = await client.database
      .from("transactions")
      .select("id")
      .or(`account_id.eq.${accountId},transfer_account_id.eq.${accountId}`)
      .limit(1)

    if (transactionsError) {
      throw transactionsError
    }

    if ((transactions ?? []).length > 0) {
      return { ok: false, message: "Accounts with transaction history cannot be deleted." }
    }

    const { data: recurring, error: recurringError } = await client.database
      .from("recurring_transactions")
      .select("id")
      .eq("account_id", accountId)
      .limit(1)

    if (recurringError) {
      throw recurringError
    }

    if ((recurring ?? []).length > 0) {
      return { ok: false, message: "Remove recurring payments from this account first." }
    }

    const { error } = await client.database.from("accounts").delete().eq("id", accountId).eq("user_id", user.id)

    if (error) {
      throw error
    }

    revalidateFinancePaths()
    return { ok: true, message: "Account deleted." }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error, "Failed to delete the account.") }
  }
}

export async function saveCategory(input: unknown): Promise<ActionResult> {
  const user = await requireCurrentUser()
  const parsed = categorySchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid category." }
  }

  try {
    const client = await createInsforgeServerClient()
    const payload = {
      name: parsed.data.name,
      type: parsed.data.type,
      color: parsed.data.color,
      icon: parsed.data.icon
    }

    if (parsed.data.id) {
      const { error } = await client.database
        .from("categories")
        .update(payload)
        .eq("id", parsed.data.id)
        .eq("user_id", user.id)
        .eq("is_default", false)

      if (error) {
        throw error
      }
    } else {
      const { error } = await client.database.from("categories").insert([
        {
          user_id: user.id,
          is_default: false,
          ...payload
        }
      ])

      if (error) {
        throw error
      }
    }

    revalidateFinancePaths()
    return { ok: true, message: parsed.data.id ? "Category updated." : "Category added." }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error, "Failed to save the category.") }
  }
}

export async function deleteCategory(categoryId: string): Promise<ActionResult> {
  const user = await requireCurrentUser()

  try {
    const client = await createInsforgeServerClient()
    const { data: categoryRows, error: categoryError } = await client.database
      .from("categories")
      .select("is_default")
      .eq("id", categoryId)
      .eq("user_id", user.id)
      .limit(1)

    if (categoryError) {
      throw categoryError
    }

    if (!categoryRows?.length) {
      return { ok: false, message: "Category not found." }
    }

    if (categoryRows[0]?.is_default) {
      return { ok: false, message: "Default categories cannot be deleted." }
    }

    const { error } = await client.database.from("categories").delete().eq("id", categoryId).eq("user_id", user.id)

    if (error) {
      throw error
    }

    revalidateFinancePaths()
    return { ok: true, message: "Category deleted." }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error, "Failed to delete the category.") }
  }
}

export async function saveTransaction(input: unknown): Promise<ActionResult> {
  const user = await requireCurrentUser()
  const parsed = transactionSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid transaction." }
  }

  try {
    const client = await createInsforgeServerClient()
    const payload = {
      account_id: parsed.data.accountId,
      transfer_account_id: parsed.data.type === "transfer" ? parsed.data.transferAccountId : null,
      category_id: parsed.data.type === "transfer" ? null : parsed.data.categoryId,
      type: parsed.data.type,
      amount: parsed.data.amount,
      description: parsed.data.description,
      notes: parsed.data.notes?.trim() ? parsed.data.notes.trim() : null,
      transaction_date: parsed.data.transactionDate,
      is_recurring: parsed.data.isRecurring
    }

    if (parsed.data.id) {
      const { error } = await client.database.from("transactions").update(payload).eq("id", parsed.data.id).eq("user_id", user.id)
      if (error) {
        throw error
      }
    } else {
      const { error } = await client.database.from("transactions").insert([
        {
          user_id: user.id,
          ...payload
        }
      ])

      if (error) {
        throw error
      }
    }

    revalidateFinancePaths()
    return { ok: true, message: parsed.data.id ? "Transaction updated." : "Transaction saved." }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error, "Failed to save the transaction.") }
  }
}

export async function deleteTransaction(transactionId: string): Promise<ActionResult> {
  const user = await requireCurrentUser()

  try {
    const client = await createInsforgeServerClient()
    const { error } = await client.database.from("transactions").delete().eq("id", transactionId).eq("user_id", user.id)

    if (error) {
      throw error
    }

    revalidateFinancePaths()
    return { ok: true, message: "Transaction deleted." }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error, "Failed to delete the transaction.") }
  }
}

export async function saveBudget(input: unknown): Promise<ActionResult> {
  const user = await requireCurrentUser()
  const parsed = budgetSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid budget." }
  }

  try {
    const client = await createInsforgeServerClient()
    const payload = {
      category_id: parsed.data.categoryId,
      amount: parsed.data.amount,
      month: parsed.data.month,
      year: parsed.data.year
    }

    if (parsed.data.id) {
      const { error } = await client.database.from("budgets").update(payload).eq("id", parsed.data.id).eq("user_id", user.id)
      if (error) {
        throw error
      }
    } else {
      const { error } = await client.database.from("budgets").insert([
        {
          user_id: user.id,
          ...payload
        }
      ])
      if (error) {
        throw error
      }
    }

    revalidateFinancePaths()
    return { ok: true, message: parsed.data.id ? "Budget updated." : "Budget created." }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error, "Failed to save the budget.") }
  }
}

export async function deleteBudget(budgetId: string): Promise<ActionResult> {
  const user = await requireCurrentUser()

  try {
    const client = await createInsforgeServerClient()
    const { error } = await client.database.from("budgets").delete().eq("id", budgetId).eq("user_id", user.id)

    if (error) {
      throw error
    }

    revalidateFinancePaths()
    return { ok: true, message: "Budget deleted." }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error, "Failed to delete the budget.") }
  }
}

export async function saveGoal(input: unknown): Promise<ActionResult> {
  const user = await requireCurrentUser()
  const parsed = savingsGoalSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid savings goal." }
  }

  try {
    const client = await createInsforgeServerClient()
    const payload = {
      name: parsed.data.name,
      target_amount: parsed.data.targetAmount,
      current_amount: parsed.data.currentAmount,
      deadline: parsed.data.deadline?.trim() ? parsed.data.deadline : null
    }

    if (parsed.data.id) {
      const { error } = await client.database.from("savings_goals").update(payload).eq("id", parsed.data.id).eq("user_id", user.id)
      if (error) {
        throw error
      }
    } else {
      const { error } = await client.database.from("savings_goals").insert([
        {
          user_id: user.id,
          ...payload
        }
      ])
      if (error) {
        throw error
      }
    }

    revalidateFinancePaths()
    return { ok: true, message: parsed.data.id ? "Goal updated." : "Goal created." }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error, "Failed to save the goal.") }
  }
}

export async function deleteGoal(goalId: string): Promise<ActionResult> {
  const user = await requireCurrentUser()

  try {
    const client = await createInsforgeServerClient()
    const { error } = await client.database.from("savings_goals").delete().eq("id", goalId).eq("user_id", user.id)

    if (error) {
      throw error
    }

    revalidateFinancePaths()
    return { ok: true, message: "Goal deleted." }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error, "Failed to delete the goal.") }
  }
}

export async function saveRecurringTransaction(input: unknown): Promise<ActionResult> {
  const user = await requireCurrentUser()
  const parsed = recurringTransactionSchema.safeParse(input)

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid recurring payment." }
  }

  try {
    const client = await createInsforgeServerClient()
    const payload = {
      account_id: parsed.data.accountId,
      category_id: parsed.data.categoryId,
      type: parsed.data.type,
      amount: parsed.data.amount,
      description: parsed.data.description,
      frequency: parsed.data.frequency,
      next_due_date: parsed.data.nextDueDate,
      active: parsed.data.active
    }

    if (parsed.data.id) {
      const { error } = await client.database
        .from("recurring_transactions")
        .update(payload)
        .eq("id", parsed.data.id)
        .eq("user_id", user.id)
      if (error) {
        throw error
      }

      const { error: reminderError } = await client.database
        .from("recurring_reminders")
        .delete()
        .eq("user_id", user.id)
        .eq("recurring_transaction_id", parsed.data.id)
        .is("dismissed_at", null)

      if (reminderError) {
        throw reminderError
      }
    } else {
      const { error } = await client.database.from("recurring_transactions").insert([
        {
          user_id: user.id,
          ...payload
        }
      ])
      if (error) {
        throw error
      }
    }

    if (parsed.data.active) {
      const { error: syncError } = await client.database.rpc("generate_recurring_reminders", {
        p_target_user_id: user.id
      })

      if (syncError) {
        throw syncError
      }
    }

    revalidateFinancePaths()
    return { ok: true, message: parsed.data.id ? "Recurring payment updated." : "Recurring payment created." }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error, "Failed to save the recurring payment.") }
  }
}

export async function toggleRecurringTransaction(recurringId: string, active: boolean): Promise<ActionResult> {
  const user = await requireCurrentUser()

  try {
    const client = await createInsforgeServerClient()
    const { error } = await client.database
      .from("recurring_transactions")
      .update({ active })
      .eq("id", recurringId)
      .eq("user_id", user.id)

    if (error) {
      throw error
    }

    if (!active) {
      const { error: reminderError } = await client.database
        .from("recurring_reminders")
        .delete()
        .eq("user_id", user.id)
        .eq("recurring_transaction_id", recurringId)
        .is("dismissed_at", null)

      if (reminderError) {
        throw reminderError
      }
    } else {
      const { error: syncError } = await client.database.rpc("generate_recurring_reminders", {
        p_target_user_id: user.id
      })

      if (syncError) {
        throw syncError
      }
    }

    revalidateFinancePaths()
    return { ok: true, message: active ? "Reminder enabled." : "Reminder paused." }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error, "Failed to update the recurring payment.") }
  }
}

export async function deleteRecurringTransaction(recurringId: string): Promise<ActionResult> {
  const user = await requireCurrentUser()

  try {
    const client = await createInsforgeServerClient()
    const { error } = await client.database.from("recurring_transactions").delete().eq("id", recurringId).eq("user_id", user.id)

    if (error) {
      throw error
    }

    revalidateFinancePaths()
    return { ok: true, message: "Recurring payment deleted." }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error, "Failed to delete the recurring payment.") }
  }
}
