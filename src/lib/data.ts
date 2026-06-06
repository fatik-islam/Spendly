import { addDays, format, isSameMonth, isSameYear, parseISO, startOfMonth, subMonths } from "date-fns"

import { DEFAULT_CURRENCY } from "@/lib/constants"
import { stringifyCsv } from "@/lib/csv"
import { getCurrentUser, requireCurrentUser } from "@/lib/auth"
import { getErrorMessage } from "@/lib/errors"
import { type ExportDataset } from "@/lib/export-config"
import { createInsforgeServerClient } from "@/lib/insforge/server"
import { getReminderCenterData, syncRecurringRemindersForUser } from "@/lib/reminders"
import { calculateFinancialHealthScore, canLoadDemoWorkspace } from "@/lib/workspace-utils"
import {
  type Account,
  type AuthUser,
  type Budget,
  type Category,
  type CurrencyCode,
  type DashboardSnapshot,
  type Profile,
  type RecurringTransaction,
  type SavingsGoal,
  type Transaction
} from "@/lib/types"
import { clamp, toCurrencyNumber } from "@/lib/utils"

async function ensureBootstrap(user: AuthUser) {
  const client = await createInsforgeServerClient()
  await client.database.rpc("bootstrap_spendly_user", {
    p_full_name: user.name ?? "",
    p_currency: DEFAULT_CURRENCY
  })
}

async function fetchOwnedRows<T>(table: string, orderBy?: { column: string; ascending?: boolean }) {
  const client = await createInsforgeServerClient()
  let query = client.database.from(table).select()

  if (orderBy) {
    query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true })
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as T[]
}

function joinTransactions(transactions: Transaction[], accounts: Account[], categories: Category[]) {
  const accountsById = new Map(accounts.map((account) => [account.id, account]))
  const categoriesById = new Map(categories.map((category) => [category.id, category]))

  return transactions.map((transaction) => ({
    ...transaction,
    account: accountsById.get(transaction.account_id)
      ? {
          id: accountsById.get(transaction.account_id)!.id,
          name: accountsById.get(transaction.account_id)!.name,
          type: accountsById.get(transaction.account_id)!.type,
          currency: accountsById.get(transaction.account_id)!.currency
        }
      : undefined,
    transfer_account: transaction.transfer_account_id && accountsById.get(transaction.transfer_account_id)
      ? {
          id: accountsById.get(transaction.transfer_account_id)!.id,
          name: accountsById.get(transaction.transfer_account_id)!.name,
          type: accountsById.get(transaction.transfer_account_id)!.type,
          currency: accountsById.get(transaction.transfer_account_id)!.currency
        }
      : null,
    category: transaction.category_id && categoriesById.get(transaction.category_id)
      ? {
          id: categoriesById.get(transaction.category_id)!.id,
          name: categoriesById.get(transaction.category_id)!.name,
          type: categoriesById.get(transaction.category_id)!.type,
          color: categoriesById.get(transaction.category_id)!.color,
          icon: categoriesById.get(transaction.category_id)!.icon
        }
      : null
  }))
}

function joinBudgets(budgets: Budget[], categories: Category[]) {
  const categoriesById = new Map(categories.map((category) => [category.id, category]))

  return budgets.map((budget) => ({
    ...budget,
    category: categoriesById.get(budget.category_id)
      ? {
          id: categoriesById.get(budget.category_id)!.id,
          name: categoriesById.get(budget.category_id)!.name,
          color: categoriesById.get(budget.category_id)!.color,
          icon: categoriesById.get(budget.category_id)!.icon
        }
      : undefined
  }))
}

function joinRecurring(items: RecurringTransaction[], accounts: Account[], categories: Category[]) {
  const accountsById = new Map(accounts.map((account) => [account.id, account]))
  const categoriesById = new Map(categories.map((category) => [category.id, category]))

  return items.map((item) => ({
    ...item,
    account: accountsById.get(item.account_id)
      ? {
          id: accountsById.get(item.account_id)!.id,
          name: accountsById.get(item.account_id)!.name,
          type: accountsById.get(item.account_id)!.type,
          currency: accountsById.get(item.account_id)!.currency
        }
      : undefined,
    category: item.category_id && categoriesById.get(item.category_id)
      ? {
          id: categoriesById.get(item.category_id)!.id,
          name: categoriesById.get(item.category_id)!.name,
          color: categoriesById.get(item.category_id)!.color,
          icon: categoriesById.get(item.category_id)!.icon
        }
      : null
  }))
}

export async function getWorkspaceContext() {
  const user = await requireCurrentUser()
  await ensureBootstrap(user)

  const [profiles, accounts, categories] = await Promise.all([
    fetchOwnedRows<Profile>("profiles", { column: "created_at", ascending: false }),
    fetchOwnedRows<Account>("accounts", { column: "created_at" }),
    fetchOwnedRows<Category>("categories", { column: "created_at" })
  ])

  return {
    user,
    profile: profiles[0] ?? null,
    accounts,
    categories
  }
}

export async function getAppShellData() {
  const { user, profile } = await getWorkspaceContext()
  await syncRecurringRemindersForUser(user.id)
  const reminderCenter = await getReminderCenterData()

  return {
    user,
    profile,
    reminderCenter
  }
}

export async function getOptionalWorkspaceContext() {
  const user = await getCurrentUser()

  if (!user) {
    return null
  }

  await ensureBootstrap(user)

  const [profiles] = await Promise.all([fetchOwnedRows<Profile>("profiles", { column: "created_at", ascending: false })])

  return {
    user,
    profile: profiles[0] ?? null
  }
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot & { currency: CurrencyCode }> {
  const [{ profile, accounts, categories }, transactionsRaw, budgetsRaw, goals, recurringRaw] = await Promise.all([
    getWorkspaceContext(),
    fetchOwnedRows<Transaction>("transactions", { column: "transaction_date", ascending: false }),
    fetchOwnedRows<Budget>("budgets", { column: "updated_at", ascending: false }),
    fetchOwnedRows<SavingsGoal>("savings_goals", { column: "updated_at", ascending: false }),
    fetchOwnedRows<RecurringTransaction>("recurring_transactions", { column: "next_due_date" })
  ])

  const transactions = joinTransactions(transactionsRaw, accounts, categories)
  const budgets = joinBudgets(budgetsRaw, categories)
  const recurring = joinRecurring(recurringRaw, accounts, categories)

  const currency: CurrencyCode = profile?.currency ?? DEFAULT_CURRENCY
  const totalBalance = accounts.reduce((sum, account) => sum + toCurrencyNumber(account.balance), 0)
  const now = new Date()
  const startMonth = startOfMonth(now)
  const currentMonthTransactions = transactions.filter((transaction) => {
    const date = parseISO(transaction.transaction_date)
    return isSameMonth(date, startMonth) && isSameYear(date, startMonth)
  })

  const monthlyIncome = currentMonthTransactions
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + toCurrencyNumber(transaction.amount), 0)

  const monthlyExpenses = currentMonthTransactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + toCurrencyNumber(transaction.amount), 0)

  const netSavings = monthlyIncome - monthlyExpenses
  const savingsRate = monthlyIncome > 0 ? clamp((netSavings / monthlyIncome) * 100, 0, 100) : 0

  const lastSixMonths = Array.from({ length: 6 }, (_, index) => subMonths(startMonth, 5 - index))
  const trend = lastSixMonths.map((monthDate) => {
    const monthTransactions = transactions.filter((transaction) => {
      const transactionDate = parseISO(transaction.transaction_date)
      return isSameMonth(transactionDate, monthDate) && isSameYear(transactionDate, monthDate)
    })

    const income = monthTransactions
      .filter((transaction) => transaction.type === "income")
      .reduce((sum, transaction) => sum + toCurrencyNumber(transaction.amount), 0)
    const expenses = monthTransactions
      .filter((transaction) => transaction.type === "expense")
      .reduce((sum, transaction) => sum + toCurrencyNumber(transaction.amount), 0)

    return {
      month: format(monthDate, "MMM"),
      income,
      expenses,
      savings: income - expenses
    }
  })

  const categoryBreakdownSource = currentMonthTransactions.filter(
    (transaction) => transaction.type === "expense" && transaction.category
  )
  const categoryMap = new Map<string, { name: string; value: number; color: string }>()

  for (const transaction of categoryBreakdownSource) {
    const key = transaction.category!.id
    const current = categoryMap.get(key) ?? {
      name: transaction.category!.name,
      value: 0,
      color: transaction.category!.color
    }

    current.value += toCurrencyNumber(transaction.amount)
    categoryMap.set(key, current)
  }

  const categoryBreakdown = Array.from(categoryMap.values()).sort((left, right) => right.value - left.value)

  const budgetCards = budgets
    .filter((budget) => budget.month === startMonth.getMonth() + 1 && budget.year === startMonth.getFullYear())
    .map((budget) => {
      const spent = currentMonthTransactions
        .filter((transaction) => transaction.type === "expense" && transaction.category_id === budget.category_id)
        .reduce((sum, transaction) => sum + toCurrencyNumber(transaction.amount), 0)
      const amount = toCurrencyNumber(budget.amount)
      const progress = amount > 0 ? clamp((spent / amount) * 100, 0, 130) : 0

      return {
        id: budget.id,
        name: budget.category?.name ?? "Uncategorized",
        color: budget.category?.color ?? "#14B8A6",
        amount,
        spent,
        progress
      }
    })
    .sort((left, right) => right.progress - left.progress)

  const goalsSnapshot = goals.map((goal) => {
    const targetAmount = toCurrencyNumber(goal.target_amount)
    const currentAmount = toCurrencyNumber(goal.current_amount)

    return {
      id: goal.id,
      name: goal.name,
      targetAmount,
      currentAmount,
      progress: targetAmount > 0 ? clamp((currentAmount / targetAmount) * 100, 0, 100) : 0,
      deadline: goal.deadline
    }
  })

  const budgetEfficiency = budgetCards.length
    ? budgetCards.reduce((sum, budget) => sum + clamp(100 - budget.progress, 0, 100), 0) / budgetCards.length / 5
    : 14

  return {
    currency,
    totalBalance,
    monthlyIncome,
    monthlyExpenses,
    netSavings,
    savingsRate,
    financialHealthScore: calculateFinancialHealthScore({
      totalBalance,
      savingsRate,
      monthlyExpenses,
      budgetEfficiency
    }),
    canLoadDemoData: canLoadDemoWorkspace({
      accounts,
      transactionsCount: transactions.length,
      budgetsCount: budgets.length,
      goalsCount: goals.length,
      recurringCount: recurring.length
    }),
    trend,
    categoryBreakdown,
    recentTransactions: transactions.slice(0, 8),
    upcomingRecurring: recurring
      .filter((item) => item.active)
      .filter((item) => parseISO(item.next_due_date) <= addDays(now, 30))
      .slice(0, 6),
    budgets: budgetCards,
    goals: goalsSnapshot
  }
}

export async function getTransactionsPageData() {
  const [{ profile, accounts, categories }, transactionsRaw] = await Promise.all([
    getWorkspaceContext(),
    fetchOwnedRows<Transaction>("transactions", { column: "transaction_date", ascending: false })
  ])

  return {
    currency: profile?.currency ?? DEFAULT_CURRENCY,
    accounts,
    categories,
    transactions: joinTransactions(transactionsRaw, accounts, categories)
  }
}

export async function getAccountsPageData() {
  const [{ profile, accounts }, transactionsRaw] = await Promise.all([
    getWorkspaceContext(),
    fetchOwnedRows<Transaction>("transactions", { column: "transaction_date", ascending: false })
  ])

  const transactionsByAccount = new Map<string, number>()
  for (const transaction of transactionsRaw) {
    transactionsByAccount.set(transaction.account_id, (transactionsByAccount.get(transaction.account_id) ?? 0) + 1)
    if (transaction.transfer_account_id) {
      transactionsByAccount.set(transaction.transfer_account_id, (transactionsByAccount.get(transaction.transfer_account_id) ?? 0) + 1)
    }
  }

  return {
    currency: profile?.currency ?? DEFAULT_CURRENCY,
    accounts: accounts.map((account) => ({
      ...account,
      activityCount: transactionsByAccount.get(account.id) ?? 0
    }))
  }
}

export async function getBudgetsPageData() {
  const [{ profile, categories }, budgetsRaw, transactionsRaw] = await Promise.all([
    getWorkspaceContext(),
    fetchOwnedRows<Budget>("budgets", { column: "updated_at", ascending: false }),
    fetchOwnedRows<Transaction>("transactions", { column: "transaction_date", ascending: false })
  ])

  const budgets = joinBudgets(budgetsRaw, categories)

  return {
    currency: profile?.currency ?? DEFAULT_CURRENCY,
    categories: categories.filter((category) => category.type === "expense"),
    budgets: budgets.map((budget) => {
      const spent = transactionsRaw
        .filter((transaction) => transaction.type === "expense")
        .filter((transaction) => {
          const transactionDate = parseISO(transaction.transaction_date)
          return transaction.category_id === budget.category_id && transactionDate.getMonth() + 1 === budget.month && transactionDate.getFullYear() === budget.year
        })
        .reduce((sum, transaction) => sum + toCurrencyNumber(transaction.amount), 0)

      const amount = toCurrencyNumber(budget.amount)
      return {
        ...budget,
        spent,
        remaining: amount - spent,
        progress: amount > 0 ? clamp((spent / amount) * 100, 0, 130) : 0
      }
    })
  }
}

export async function getGoalsPageData() {
  const { profile } = await getWorkspaceContext()
  const goals = await fetchOwnedRows<SavingsGoal>("savings_goals", { column: "updated_at", ascending: false })

  return {
    currency: profile?.currency ?? DEFAULT_CURRENCY,
    goals
  }
}

export async function getRecurringPageData() {
  const { user, profile, accounts, categories } = await getWorkspaceContext()
  await syncRecurringRemindersForUser(user.id)

  const [recurringRaw, reminderCenter] = await Promise.all([
    fetchOwnedRows<RecurringTransaction>("recurring_transactions", { column: "next_due_date" }),
    getReminderCenterData()
  ])

  return {
    currency: profile?.currency ?? DEFAULT_CURRENCY,
    accounts,
    categories: categories.filter((category) => category.type !== "income" || category.name !== "Other"),
    recurringTransactions: joinRecurring(recurringRaw, accounts, categories),
    reminderCenter,
    reminderPreferences: {
      reminderDaysBefore: profile?.reminder_days_before ?? 3,
      reminderInAppEnabled: profile?.reminder_in_app_enabled ?? true,
      reminderEmailEnabled: profile?.reminder_email_enabled ?? false
    }
  }
}

export async function getInsightsPageData() {
  const snapshot = await getDashboardSnapshot()
  const { transactions, categories } = await getTransactionsPageData()

  const twelveMonthSummary = Array.from({ length: 12 }, (_, index) => subMonths(startOfMonth(new Date()), 11 - index)).map((date) => {
    const monthTransactions = transactions.filter((transaction) => {
      const transactionDate = parseISO(transaction.transaction_date)
      return isSameMonth(transactionDate, date) && isSameYear(transactionDate, date)
    })

    const income = monthTransactions
      .filter((transaction) => transaction.type === "income")
      .reduce((sum, transaction) => sum + toCurrencyNumber(transaction.amount), 0)
    const expense = monthTransactions
      .filter((transaction) => transaction.type === "expense")
      .reduce((sum, transaction) => sum + toCurrencyNumber(transaction.amount), 0)

    return {
      month: format(date, "MMM"),
      income,
      expense
    }
  })

  const expenseCategories = categories.filter((category) => category.type === "expense")
  const topCategories = expenseCategories
    .map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
      spent: transactions
        .filter((transaction) => transaction.type === "expense" && transaction.category_id === category.id)
        .reduce((sum, transaction) => sum + toCurrencyNumber(transaction.amount), 0)
    }))
    .sort((left, right) => right.spent - left.spent)
    .slice(0, 5)

  return {
    currency: snapshot.currency,
    snapshot,
    monthlyComparison: twelveMonthSummary,
    topCategories
  }
}

export async function getSettingsPageData() {
  const [{ user, profile, accounts, categories }, transactionsRaw, budgetsRaw, goals, recurringRaw] = await Promise.all([
    getWorkspaceContext(),
    fetchOwnedRows<Transaction>("transactions", { column: "transaction_date", ascending: false }),
    fetchOwnedRows<Budget>("budgets", { column: "updated_at", ascending: false }),
    fetchOwnedRows<SavingsGoal>("savings_goals", { column: "updated_at", ascending: false }),
    fetchOwnedRows<RecurringTransaction>("recurring_transactions", { column: "next_due_date" })
  ])

  return {
    user,
    profile,
    categories: categories.sort((left, right) => left.name.localeCompare(right.name)),
    canLoadDemoData: canLoadDemoWorkspace({
      accounts,
      transactionsCount: transactionsRaw.length,
      budgetsCount: budgetsRaw.length,
      goalsCount: goals.length,
      recurringCount: recurringRaw.length
    })
  }
}

export async function exportWorkspaceCsv(dataset: ExportDataset) {
  const [{ user, profile, accounts, categories }, transactionsRaw, budgetsRaw, goals, recurringRaw] = await Promise.all([
    getWorkspaceContext(),
    fetchOwnedRows<Transaction>("transactions", { column: "transaction_date", ascending: false }),
    fetchOwnedRows<Budget>("budgets", { column: "updated_at", ascending: false }),
    fetchOwnedRows<SavingsGoal>("savings_goals", { column: "updated_at", ascending: false }),
    fetchOwnedRows<RecurringTransaction>("recurring_transactions", { column: "next_due_date" })
  ])

  const currency: CurrencyCode = profile?.currency ?? DEFAULT_CURRENCY
  const transactions = joinTransactions(transactionsRaw, accounts, categories)
  const budgets = joinBudgets(budgetsRaw, categories)
  const recurring = joinRecurring(recurringRaw, accounts, categories)

  let filenameSuffix: string = dataset
  let header: string[] = []
  let rows: Array<Array<string | number | boolean | null | undefined>> = []

  switch (dataset) {
    case "profile":
      filenameSuffix = "profile"
      header = [
        "Email",
        "Full Name",
        "Currency",
        "Reminder Days Before",
        "In-App Reminders",
        "Email Reminders",
        "Created At",
        "Updated At"
      ]
      rows = profile
        ? [[
            user.email ?? "",
            profile.full_name ?? "",
            profile.currency,
            profile.reminder_days_before,
            profile.reminder_in_app_enabled ? "Yes" : "No",
            profile.reminder_email_enabled ? "Yes" : "No",
            profile.created_at,
            profile.updated_at
          ]]
        : []
      break

    case "accounts":
      filenameSuffix = "accounts"
      header = ["Name", "Type", "Balance", "Currency", "Created At", "Updated At"]
      rows = accounts.map((account) => [
        account.name,
        account.type,
        toCurrencyNumber(account.balance).toFixed(2),
        account.currency,
        account.created_at,
        account.updated_at
      ])
      break

    case "categories":
      filenameSuffix = "categories"
      header = ["Name", "Type", "Color", "Icon", "Default", "Created At"]
      rows = categories.map((category) => [
        category.name,
        category.type,
        category.color,
        category.icon,
        category.is_default ? "Yes" : "No",
        category.created_at
      ])
      break

    case "transactions":
      filenameSuffix = "transactions"
      header = [
        "Date",
        "Type",
        "Description",
        "Amount",
        "Currency",
        "Account",
        "Account Type",
        "Destination Account",
        "Destination Account Type",
        "Category",
        "Notes",
        "Recurring",
        "Created At",
        "Updated At"
      ]
      rows = transactions.map((transaction) => [
        transaction.transaction_date,
        transaction.type,
        transaction.description,
        toCurrencyNumber(transaction.amount).toFixed(2),
        currency,
        transaction.account?.name ?? "",
        transaction.account?.type ?? "",
        transaction.transfer_account?.name ?? "",
        transaction.transfer_account?.type ?? "",
        transaction.category?.name ?? "",
        transaction.notes ?? "",
        transaction.is_recurring ? "Yes" : "No",
        transaction.created_at,
        transaction.updated_at
      ])
      break

    case "budgets":
      filenameSuffix = "budgets"
      header = ["Category", "Amount", "Currency", "Month", "Year", "Created At", "Updated At"]
      rows = budgets.map((budget) => [
        budget.category?.name ?? "",
        toCurrencyNumber(budget.amount).toFixed(2),
        currency,
        budget.month,
        budget.year,
        budget.created_at,
        budget.updated_at
      ])
      break

    case "goals":
      filenameSuffix = "savings-goals"
      header = ["Name", "Target Amount", "Current Amount", "Currency", "Deadline", "Created At", "Updated At"]
      rows = goals.map((goal) => [
        goal.name,
        toCurrencyNumber(goal.target_amount).toFixed(2),
        toCurrencyNumber(goal.current_amount).toFixed(2),
        currency,
        goal.deadline ?? "",
        goal.created_at,
        goal.updated_at
      ])
      break

    case "recurring":
      filenameSuffix = "recurring-transactions"
      header = [
        "Type",
        "Description",
        "Amount",
        "Currency",
        "Frequency",
        "Next Due Date",
        "Account",
        "Account Type",
        "Category",
        "Active",
        "Created At",
        "Updated At"
      ]
      rows = recurring.map((item) => [
        item.type,
        item.description,
        toCurrencyNumber(item.amount).toFixed(2),
        currency,
        item.frequency,
        item.next_due_date,
        item.account?.name ?? "",
        item.account?.type ?? "",
        item.category?.name ?? "",
        item.active ? "Yes" : "No",
        item.created_at,
        item.updated_at
      ])
      break
  }

  return {
    filename: `spendly-${filenameSuffix}-${format(new Date(), "yyyy-MM-dd")}.csv`,
    csv: stringifyCsv([header, ...rows])
  }
}

export async function describeBootstrapError() {
  try {
    await getWorkspaceContext()
    return null
  } catch (error) {
    return getErrorMessage(error)
  }
}
