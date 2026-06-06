import { clamp, toCurrencyNumber } from "@/lib/utils"
import { type Account } from "@/lib/types"

export function calculateFinancialHealthScore(input: {
  totalBalance: number
  savingsRate: number
  monthlyExpenses: number
  budgetEfficiency: number
}) {
  const balanceScore = input.totalBalance > 0 ? 28 : 10
  const savingsScore = clamp(input.savingsRate, 0, 30)
  const spendingScore = input.monthlyExpenses > 0 ? clamp(22 - input.monthlyExpenses / 150, 6, 22) : 18
  const budgetScore = clamp(input.budgetEfficiency, 0, 20)

  return Math.round(clamp(balanceScore + savingsScore + spendingScore + budgetScore, 0, 100))
}

export function canLoadDemoWorkspace(input: {
  accounts: Account[]
  transactionsCount: number
  budgetsCount: number
  goalsCount: number
  recurringCount: number
}) {
  const allBalancesZero = input.accounts.every((account) => toCurrencyNumber(account.balance) === 0)

  return (
    allBalancesZero &&
    input.transactionsCount === 0 &&
    input.budgetsCount === 0 &&
    input.goalsCount === 0 &&
    input.recurringCount === 0
  )
}
