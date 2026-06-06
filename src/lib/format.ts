import { format, isThisYear, parseISO } from "date-fns"

import { DEFAULT_CURRENCY } from "@/lib/constants"
import { type CurrencyCode } from "@/lib/types"
import { toCurrencyNumber } from "@/lib/utils"

export function formatCurrency(value: number | string, currency: CurrencyCode = DEFAULT_CURRENCY) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(toCurrencyNumber(value))
}

export function formatDate(date: string | Date, pattern = "MMM d, yyyy") {
  const value = typeof date === "string" ? parseISO(date) : date
  return format(value, pattern)
}

export function formatShortMonth(date: string | Date) {
  const value = typeof date === "string" ? parseISO(date) : date
  return isThisYear(value) ? format(value, "MMM d") : format(value, "MMM d, yyyy")
}
