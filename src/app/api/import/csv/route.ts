import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { format } from "date-fns"
import { createServerClient } from "@insforge/sdk/ssr"

import {
  ACCOUNT_TYPES,
  CATEGORY_COLOR_PALETTE,
  CURRENCY_OPTIONS,
  DEFAULT_ACCOUNTS,
  DEFAULT_CATEGORIES
} from "@/lib/constants"
import { getErrorMessage } from "@/lib/errors"
import { type Account, type AccountType, type Category, type CategoryType, type CurrencyCode, type Transaction } from "@/lib/types"
import { transactionSchema } from "@/lib/validation/finance"

type ImportableTransactionType = Transaction["type"]

interface ParsedImportRow {
  rowNumber: number
  transactionDate: string
  type: ImportableTransactionType
  amount: number
  description: string
  currency: CurrencyCode | null
  accountName: string
  accountType: AccountType | null
  destinationAccountName: string | null
  destinationAccountType: AccountType | null
  categoryName: string | null
  notes: string | null
  isRecurring: boolean
}

interface ImportSummary {
  totalRows: number
  importedCount: number
  duplicateCount: number
  errorCount: number
  createdAccounts: string[]
  createdCategories: string[]
  errors: Array<{ row: number; message: string }>
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

const HEADER_ALIASES = {
  date: ["date", "transactiondate", "transaction_date"],
  type: ["type", "transactiontype", "transaction_type"],
  description: ["description", "details", "memo"],
  amount: ["amount", "value"],
  currency: ["currency"],
  account: ["account", "accountname", "sourceaccount", "sourceaccountname"],
  accountType: ["accounttype", "account_type", "sourceaccounttype", "sourceaccount_type"],
  destinationAccount: [
    "destinationaccount",
    "destinationaccountname",
    "destination_account",
    "destination_account_name",
    "transferaccount",
    "transferaccountname",
    "toaccount"
  ],
  destinationAccountType: [
    "destinationaccounttype",
    "destination_account_type",
    "transferaccounttype",
    "transferaccount_type"
  ],
  category: ["category", "categoryname", "category_name"],
  notes: ["notes", "note"],
  recurring: ["recurring", "isrecurring", "is_recurring"]
} as const

function revalidateFinancePaths() {
  for (const path of PATHS_TO_REVALIDATE) {
    revalidatePath(path)
  }
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase()
}

function isSupportedCurrency(value: string): value is CurrencyCode {
  return CURRENCY_OPTIONS.includes(value as CurrencyCode)
}

function isSupportedAccountType(value: string): value is AccountType {
  return ACCOUNT_TYPES.includes(value as AccountType)
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentValue = ""
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]

    if (character === '"') {
      const nextCharacter = text[index + 1]
      if (inQuotes && nextCharacter === '"') {
        currentValue += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (character === "," && !inQuotes) {
      currentRow.push(currentValue)
      currentValue = ""
      continue
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && text[index + 1] === "\n") {
        index += 1
      }
      currentRow.push(currentValue)
      rows.push(currentRow)
      currentRow = []
      currentValue = ""
      continue
    }

    currentValue += character
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue)
    rows.push(currentRow)
  }

  return rows.filter((row) => row.some((value) => value.trim().length > 0))
}

function findColumnIndex(headers: string[], aliases: readonly string[]) {
  return headers.findIndex((header) => aliases.includes(header))
}

function parseTransactionType(value: string): ImportableTransactionType | null {
  const normalized = normalizeHeader(value)

  if (normalized === "income" || normalized === "expense" || normalized === "transfer") {
    return normalized
  }

  return null
}

function parseRecurringFlag(value: string) {
  const normalized = value.trim().toLowerCase()
  return normalized === "yes" || normalized === "true" || normalized === "1" || normalized === "y"
}

function parseAmount(value: string) {
  const normalized = value.replace(/[^0-9.-]/g, "")
  const amount = Number.parseFloat(normalized)
  return Number.isFinite(amount) ? amount : Number.NaN
}

function parseDateValue(value: string) {
  const trimmed = value.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return format(parsed, "yyyy-MM-dd")
}

function inferAccountType(name: string, explicitType: string | null): AccountType {
  if (explicitType && isSupportedAccountType(explicitType)) {
    return explicitType
  }

  const normalized = normalizeName(name)
  const defaultMatch = DEFAULT_ACCOUNTS.find((account) => normalizeName(account.name) === normalized)
  if (defaultMatch) {
    return defaultMatch.type
  }

  if (normalized.includes("credit") || normalized.includes("card")) {
    return "credit-card"
  }

  if (normalized.includes("saving")) {
    return "savings"
  }

  if (normalized.includes("cash")) {
    return "cash"
  }

  return "bank"
}

function inferCurrency(value: string | null, fallbackCurrency: CurrencyCode): CurrencyCode {
  if (value && isSupportedCurrency(value)) {
    return value
  }

  return fallbackCurrency
}

function inferCategoryStyle(name: string, type: CategoryType) {
  const defaultMatch = DEFAULT_CATEGORIES.find(
    (category) => category.type === type && normalizeName(category.name) === normalizeName(name)
  )

  if (defaultMatch) {
    return {
      color: defaultMatch.color,
      icon: defaultMatch.icon
    }
  }

  const hash = Array.from(name).reduce((sum, character) => sum + character.charCodeAt(0), 0)
  return {
    color: CATEGORY_COLOR_PALETTE[hash % CATEGORY_COLOR_PALETTE.length] ?? CATEGORY_COLOR_PALETTE[0],
    icon: type === "income" ? "briefcase-business" : "piggy-bank"
  }
}

function fingerprintTransaction(input: {
  accountId: string
  transferAccountId: string | null
  categoryId: string | null
  type: ImportableTransactionType
  amount: number
  description: string
  notes: string | null
  transactionDate: string
  isRecurring: boolean
}) {
  return [
    input.accountId,
    input.transferAccountId ?? "",
    input.categoryId ?? "",
    input.type,
    input.amount.toFixed(2),
    input.description.trim().toLowerCase(),
    (input.notes ?? "").trim().toLowerCase(),
    input.transactionDate,
    input.isRecurring ? "1" : "0"
  ].join("|")
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error: "INVALID_FILE",
          message: "Choose a CSV file to import."
        },
        { status: 400 }
      )
    }

    const text = await file.text()
    if (!text.trim()) {
      return NextResponse.json(
        {
          error: "EMPTY_FILE",
          message: "The selected CSV file is empty."
        },
        { status: 400 }
      )
    }

    const csvRows = parseCsv(text)
    if (csvRows.length < 2) {
      return NextResponse.json(
        {
          error: "INVALID_FILE",
          message: "The CSV file needs a header row and at least one transaction row."
        },
        { status: 400 }
      )
    }

    const [headerRow, ...dataRows] = csvRows
    const normalizedHeaders = headerRow.map((value) => normalizeHeader(value))

    const columns = {
      date: findColumnIndex(normalizedHeaders, HEADER_ALIASES.date),
      type: findColumnIndex(normalizedHeaders, HEADER_ALIASES.type),
      description: findColumnIndex(normalizedHeaders, HEADER_ALIASES.description),
      amount: findColumnIndex(normalizedHeaders, HEADER_ALIASES.amount),
      currency: findColumnIndex(normalizedHeaders, HEADER_ALIASES.currency),
      account: findColumnIndex(normalizedHeaders, HEADER_ALIASES.account),
      accountType: findColumnIndex(normalizedHeaders, HEADER_ALIASES.accountType),
      destinationAccount: findColumnIndex(normalizedHeaders, HEADER_ALIASES.destinationAccount),
      destinationAccountType: findColumnIndex(normalizedHeaders, HEADER_ALIASES.destinationAccountType),
      category: findColumnIndex(normalizedHeaders, HEADER_ALIASES.category),
      notes: findColumnIndex(normalizedHeaders, HEADER_ALIASES.notes),
      recurring: findColumnIndex(normalizedHeaders, HEADER_ALIASES.recurring)
    }

    const missingHeaders = ["date", "type", "description", "amount", "account"].filter(
      (key) => columns[key as keyof typeof columns] === -1
    )

    if (missingHeaders.length > 0) {
      return NextResponse.json(
        {
          error: "INVALID_HEADERS",
          message: `Missing required CSV columns: ${missingHeaders.join(", ")}.`
        },
        { status: 400 }
      )
    }

    if (dataRows.length > 5000) {
      return NextResponse.json(
        {
          error: "FILE_TOO_LARGE",
          message: "Import up to 5,000 transaction rows per file."
        },
        { status: 400 }
      )
    }

    const client = createServerClient()
    const currentUser = await client.auth.getCurrentUser()
    const userId = currentUser.data?.user?.id

    if (!userId) {
      return NextResponse.json(
        {
          error: "AUTH_REQUIRED",
          message: "Sign in to import transactions."
        },
        { status: 401 }
      )
    }

    const [profilesResult, accountsResult, categoriesResult, transactionsResult] = await Promise.all([
      client.database.from("profiles").select("currency").eq("user_id", userId).limit(1),
      client.database.from("accounts").select("id,name,type,currency").eq("user_id", userId),
      client.database.from("categories").select("id,name,type,color,icon,is_default").eq("user_id", userId),
      client.database
        .from("transactions")
        .select("account_id,transfer_account_id,category_id,type,amount,description,notes,transaction_date,is_recurring")
        .eq("user_id", userId)
    ])

    if (profilesResult.error || accountsResult.error || categoriesResult.error || transactionsResult.error) {
      throw profilesResult.error ?? accountsResult.error ?? categoriesResult.error ?? transactionsResult.error
    }

    const profileCurrency = (profilesResult.data?.[0]?.currency as CurrencyCode | undefined) ?? "USD"
    const accounts = (accountsResult.data ?? []) as Array<Pick<Account, "id" | "name" | "type" | "currency">>
    const categories = (categoriesResult.data ?? []) as Array<Pick<Category, "id" | "name" | "type" | "color" | "icon" | "is_default">>
    const existingTransactions = (transactionsResult.data ?? []) as Array<
      Pick<
        Transaction,
        "account_id" | "transfer_account_id" | "category_id" | "type" | "amount" | "description" | "notes" | "transaction_date" | "is_recurring"
      >
    >

    const errors: Array<{ row: number; message: string }> = []
    const parsedRows: ParsedImportRow[] = []

    for (const [rowIndex, row] of dataRows.entries()) {
      const rowNumber = rowIndex + 2
      const transactionDate = parseDateValue(row[columns.date] ?? "")
      const type = parseTransactionType(row[columns.type] ?? "")
      const description = String(row[columns.description] ?? "").trim()
      const amount = parseAmount(row[columns.amount] ?? "")
      const accountName = String(row[columns.account] ?? "").trim()
      const destinationAccountName = columns.destinationAccount >= 0 ? String(row[columns.destinationAccount] ?? "").trim() : ""
      const categoryName = columns.category >= 0 ? String(row[columns.category] ?? "").trim() : ""

      if (!transactionDate) {
        errors.push({ row: rowNumber, message: "Enter a valid transaction date." })
        continue
      }

      if (!type) {
        errors.push({ row: rowNumber, message: "Type must be income, expense, or transfer." })
        continue
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        errors.push({ row: rowNumber, message: "Amount must be a positive number." })
        continue
      }

      if (description.length < 2) {
        errors.push({ row: rowNumber, message: "Description must be at least 2 characters." })
        continue
      }

      if (accountName.length < 2) {
        errors.push({ row: rowNumber, message: "Account name must be at least 2 characters." })
        continue
      }

      if (type === "transfer" && destinationAccountName.length < 2) {
        errors.push({ row: rowNumber, message: "Transfers need a destination account." })
        continue
      }

      if (type !== "transfer" && categoryName.length < 2) {
        errors.push({ row: rowNumber, message: "Income and expense rows need a category name." })
        continue
      }

      parsedRows.push({
        rowNumber,
        transactionDate,
        type,
        amount,
        description,
        currency: inferCurrency(columns.currency >= 0 ? String(row[columns.currency] ?? "").trim().toUpperCase() : null, profileCurrency),
        accountName,
        accountType: columns.accountType >= 0 ? inferAccountType(accountName, String(row[columns.accountType] ?? "").trim()) : null,
        destinationAccountName: type === "transfer" ? destinationAccountName : null,
        destinationAccountType:
          type === "transfer" && columns.destinationAccountType >= 0
            ? inferAccountType(destinationAccountName, String(row[columns.destinationAccountType] ?? "").trim())
            : null,
        categoryName: type === "transfer" ? null : categoryName,
        notes: columns.notes >= 0 ? String(row[columns.notes] ?? "").trim() || null : null,
        isRecurring: columns.recurring >= 0 ? parseRecurringFlag(String(row[columns.recurring] ?? "")) : false
      })
    }

    const accountsByName = new Map(accounts.map((account) => [normalizeName(account.name), account]))
    const categoriesByKey = new Map(categories.map((category) => [`${category.type}:${normalizeName(category.name)}`, category]))
    const missingAccounts = new Map<string, { name: string; type: AccountType; currency: CurrencyCode }>()
    const missingCategories = new Map<string, { name: string; type: CategoryType; color: string; icon: string }>()

    for (const row of parsedRows) {
      const sourceKey = normalizeName(row.accountName)
      if (!accountsByName.has(sourceKey) && !missingAccounts.has(sourceKey)) {
        missingAccounts.set(sourceKey, {
          name: row.accountName,
          type: row.accountType ?? inferAccountType(row.accountName, null),
          currency: row.currency ?? profileCurrency
        })
      }

      if (row.destinationAccountName) {
        const destinationKey = normalizeName(row.destinationAccountName)
        if (!accountsByName.has(destinationKey) && !missingAccounts.has(destinationKey)) {
          missingAccounts.set(destinationKey, {
            name: row.destinationAccountName,
            type: row.destinationAccountType ?? inferAccountType(row.destinationAccountName, null),
            currency: row.currency ?? profileCurrency
          })
        }
      }

      if (row.categoryName && row.type !== "transfer") {
        const categoryKey = `${row.type}:${normalizeName(row.categoryName)}`
        if (!categoriesByKey.has(categoryKey) && !missingCategories.has(categoryKey)) {
          const style = inferCategoryStyle(row.categoryName, row.type)
          missingCategories.set(categoryKey, {
            name: row.categoryName,
            type: row.type,
            color: style.color,
            icon: style.icon
          })
        }
      }
    }

    const createdAccounts = Array.from(missingAccounts.values())
    if (createdAccounts.length > 0) {
      const { error } = await client.database.from("accounts").insert(
        createdAccounts.map((account) => ({
          user_id: userId,
          name: account.name,
          type: account.type,
          balance: 0,
          currency: account.currency
        }))
      )

      if (error) {
        throw error
      }
    }

    const createdCategories = Array.from(missingCategories.values())
    if (createdCategories.length > 0) {
      const { error } = await client.database.from("categories").insert(
        createdCategories.map((category) => ({
          user_id: userId,
          is_default: false,
          name: category.name,
          type: category.type,
          color: category.color,
          icon: category.icon
        }))
      )

      if (error) {
        throw error
      }
    }

    let refreshedAccounts = accounts
    let refreshedCategories = categories

    if (createdAccounts.length > 0 || createdCategories.length > 0) {
      const [accountsRefresh, categoriesRefresh] = await Promise.all([
        client.database.from("accounts").select("id,name,type,currency").eq("user_id", userId),
        client.database.from("categories").select("id,name,type,color,icon,is_default").eq("user_id", userId)
      ])

      if (accountsRefresh.error || categoriesRefresh.error) {
        throw accountsRefresh.error ?? categoriesRefresh.error
      }

      refreshedAccounts = (accountsRefresh.data ?? []) as Array<Pick<Account, "id" | "name" | "type" | "currency">>
      refreshedCategories = (categoriesRefresh.data ?? []) as Array<Pick<Category, "id" | "name" | "type" | "color" | "icon" | "is_default">>
    }

    const refreshedAccountsByName = new Map(refreshedAccounts.map((account) => [normalizeName(account.name), account]))
    const refreshedCategoriesByKey = new Map(
      refreshedCategories.map((category) => [`${category.type}:${normalizeName(category.name)}`, category])
    )

    const seenFingerprints = new Set(
      existingTransactions.map((transaction) =>
        fingerprintTransaction({
          accountId: transaction.account_id,
          transferAccountId: transaction.transfer_account_id,
          categoryId: transaction.category_id,
          type: transaction.type,
          amount: Number(transaction.amount),
          description: transaction.description,
          notes: transaction.notes,
          transactionDate: transaction.transaction_date,
          isRecurring: transaction.is_recurring
        })
      )
    )

    const payloads: Array<{
      user_id: string
      account_id: string
      transfer_account_id: string | null
      category_id: string | null
      type: ImportableTransactionType
      amount: number
      description: string
      notes: string | null
      transaction_date: string
      is_recurring: boolean
    }> = []
    let duplicateCount = 0

    for (const row of parsedRows) {
      const account = refreshedAccountsByName.get(normalizeName(row.accountName))
      const transferAccount = row.destinationAccountName
        ? refreshedAccountsByName.get(normalizeName(row.destinationAccountName))
        : undefined
      const category =
        row.categoryName && row.type !== "transfer"
          ? refreshedCategoriesByKey.get(`${row.type}:${normalizeName(row.categoryName)}`)
          : undefined

      if (!account) {
        errors.push({ row: row.rowNumber, message: `Account "${row.accountName}" could not be resolved.` })
        continue
      }

      if (row.type === "transfer" && !transferAccount) {
        errors.push({ row: row.rowNumber, message: `Destination account "${row.destinationAccountName}" could not be resolved.` })
        continue
      }

      if (row.type !== "transfer" && !category) {
        errors.push({ row: row.rowNumber, message: `Category "${row.categoryName}" could not be resolved.` })
        continue
      }

      const validation = transactionSchema.safeParse({
        accountId: account.id,
        transferAccountId: row.type === "transfer" ? transferAccount?.id ?? null : null,
        categoryId: row.type === "transfer" ? null : category?.id ?? null,
        type: row.type,
        amount: row.amount,
        description: row.description,
        notes: row.notes,
        transactionDate: row.transactionDate,
        isRecurring: row.isRecurring
      })

      if (!validation.success) {
        errors.push({
          row: row.rowNumber,
          message: validation.error.issues[0]?.message ?? "This row could not be validated."
        })
        continue
      }

      const fingerprint = fingerprintTransaction({
        accountId: validation.data.accountId,
        transferAccountId: validation.data.transferAccountId ?? null,
        categoryId: validation.data.categoryId ?? null,
        type: validation.data.type,
        amount: validation.data.amount,
        description: validation.data.description,
        notes: validation.data.notes?.trim() ? validation.data.notes.trim() : null,
        transactionDate: validation.data.transactionDate,
        isRecurring: validation.data.isRecurring
      })

      if (seenFingerprints.has(fingerprint)) {
        duplicateCount += 1
        continue
      }

      seenFingerprints.add(fingerprint)
      payloads.push({
        user_id: userId,
        account_id: validation.data.accountId,
        transfer_account_id: validation.data.transferAccountId ?? null,
        category_id: validation.data.categoryId ?? null,
        type: validation.data.type,
        amount: validation.data.amount,
        description: validation.data.description,
        notes: validation.data.notes?.trim() ? validation.data.notes.trim() : null,
        transaction_date: validation.data.transactionDate,
        is_recurring: validation.data.isRecurring
      })
    }

    if (payloads.length > 0) {
      const { error } = await client.database.from("transactions").insert(payloads)
      if (error) {
        throw error
      }

      revalidateFinancePaths()
    }

    const summary: ImportSummary = {
      totalRows: dataRows.length,
      importedCount: payloads.length,
      duplicateCount,
      errorCount: errors.length,
      createdAccounts: createdAccounts.map((account) => account.name),
      createdCategories: createdCategories.map((category) => category.name),
      errors
    }

    const messageParts = [
      payloads.length > 0
        ? `Imported ${payloads.length} ${pluralize(payloads.length, "transaction")}.`
        : duplicateCount > 0
          ? `No new transactions were imported.`
          : `No transactions were imported.`
    ]

    if (duplicateCount > 0) {
      messageParts.push(`Skipped ${duplicateCount} duplicate ${pluralize(duplicateCount, "row")}.`)
    }

    if (createdAccounts.length > 0) {
      messageParts.push(`Created ${createdAccounts.length} ${pluralize(createdAccounts.length, "account")}.`)
    }

    if (createdCategories.length > 0) {
      messageParts.push(`Created ${createdCategories.length} ${pluralize(createdCategories.length, "category")}.`)
    }

    if (errors.length > 0) {
      messageParts.push(`${errors.length} ${pluralize(errors.length, "row")} need attention.`)
    }

    if (payloads.length === 0 && duplicateCount === 0 && errors.length > 0) {
      return NextResponse.json(
        {
          error: "IMPORT_FAILED",
          message: messageParts.join(" "),
          summary
        },
        { status: 422 }
      )
    }

    return NextResponse.json({
      ok: true,
      message: messageParts.join(" "),
      summary
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "IMPORT_FAILED",
        message: getErrorMessage(error, "Failed to import the CSV file.")
      },
      { status: 500 }
    )
  }
}
