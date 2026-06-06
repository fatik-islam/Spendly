import {
  ACCOUNT_TYPES,
  CATEGORY_TYPES,
  CURRENCY_OPTIONS,
  RECURRING_FREQUENCIES,
  TRANSACTION_TYPES
} from "@/lib/constants"

export type CurrencyCode = (typeof CURRENCY_OPTIONS)[number]
export type AccountType = (typeof ACCOUNT_TYPES)[number]
export type CategoryType = (typeof CATEGORY_TYPES)[number]
export type TransactionType = (typeof TRANSACTION_TYPES)[number]
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number]

export interface AuthUser {
  id: string
  email: string | null
  name?: string | null
}

export interface Profile {
  id: string
  user_id: string
  full_name: string | null
  currency: CurrencyCode
  reminder_days_before: number
  reminder_in_app_enabled: boolean
  reminder_email_enabled: boolean
  created_at: string
  updated_at: string
}

export interface Account {
  id: string
  user_id: string
  name: string
  type: AccountType
  balance: number | string
  currency: CurrencyCode
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  type: CategoryType
  color: string
  icon: string
  is_default: boolean
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  account_id: string
  transfer_account_id: string | null
  category_id: string | null
  type: TransactionType
  amount: number | string
  description: string
  notes: string | null
  transaction_date: string
  is_recurring: boolean
  created_at: string
  updated_at: string
  account?: Pick<Account, "id" | "name" | "type" | "currency">
  transfer_account?: Pick<Account, "id" | "name" | "type" | "currency"> | null
  category?: Pick<Category, "id" | "name" | "type" | "color" | "icon"> | null
}

export interface Budget {
  id: string
  user_id: string
  category_id: string
  amount: number | string
  month: number
  year: number
  created_at: string
  updated_at: string
  category?: Pick<Category, "id" | "name" | "color" | "icon">
}

export interface SavingsGoal {
  id: string
  user_id: string
  name: string
  target_amount: number | string
  current_amount: number | string
  deadline: string | null
  created_at: string
  updated_at: string
}

export interface RecurringTransaction {
  id: string
  user_id: string
  account_id: string
  category_id: string | null
  type: Exclude<TransactionType, "transfer">
  amount: number | string
  description: string
  frequency: RecurringFrequency
  next_due_date: string
  active: boolean
  created_at: string
  updated_at: string
  account?: Pick<Account, "id" | "name" | "type" | "currency">
  category?: Pick<Category, "id" | "name" | "color" | "icon"> | null
}

export interface RecurringReminder {
  id: string
  user_id: string
  recurring_transaction_id: string
  kind: "upcoming" | "overdue"
  title: string
  body: string
  due_date: string
  remind_on: string
  email_sent_at: string | null
  email_last_error: string | null
  read_at: string | null
  dismissed_at: string | null
  created_at: string
}

export interface ReminderCenterData {
  unreadCount: number
  overdueCount: number
  upcomingCount: number
  items: RecurringReminder[]
}

export interface DashboardSnapshot {
  totalBalance: number
  monthlyIncome: number
  monthlyExpenses: number
  netSavings: number
  savingsRate: number
  financialHealthScore: number
  canLoadDemoData: boolean
  trend: Array<{ month: string; income: number; expenses: number; savings: number }>
  categoryBreakdown: Array<{ name: string; value: number; color: string }>
  recentTransactions: Transaction[]
  upcomingRecurring: RecurringTransaction[]
  budgets: Array<{
    id: string
    name: string
    color: string
    amount: number
    spent: number
    progress: number
  }>
  goals: Array<{
    id: string
    name: string
    targetAmount: number
    currentAmount: number
    progress: number
    deadline: string | null
  }>
}
