import {
  ArrowLeftRight,
  BriefcaseBusiness,
  CarTaxiFront,
  CreditCard,
  HeartPulse,
  House,
  LucideIcon,
  PiggyBank,
  Plane,
  Receipt,
  ShoppingBag,
  UtensilsCrossed,
  WalletCards
} from "lucide-react"

export const DEFAULT_CURRENCY = "USD"

export const CURRENCY_OPTIONS = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "PKR",
  "AED",
  "SAR"
] as const

export const CATEGORY_TYPES = ["income", "expense"] as const
export const TRANSACTION_TYPES = ["income", "expense", "transfer"] as const
export const ACCOUNT_TYPES = ["cash", "bank", "credit-card", "savings"] as const
export const RECURRING_FREQUENCIES = ["weekly", "monthly", "yearly"] as const

export const CATEGORY_COLOR_PALETTE = [
  "#14B8A6",
  "#22C55E",
  "#0EA5E9",
  "#F97316",
  "#F43F5E",
  "#A855F7",
  "#EAB308",
  "#06B6D4",
  "#8B5CF6",
  "#FB7185"
] as const

export const DEFAULT_ACCOUNTS = [
  { name: "Cash", type: "cash" },
  { name: "Bank", type: "bank" },
  { name: "Credit Card", type: "credit-card" },
  { name: "Savings", type: "savings" }
] as const

export const DEFAULT_CATEGORIES = [
  { name: "Food", type: "expense", color: "#F97316", icon: "utensils-crossed" },
  { name: "Rent", type: "expense", color: "#14B8A6", icon: "house" },
  { name: "Transport", type: "expense", color: "#0EA5E9", icon: "car-taxi-front" },
  { name: "Shopping", type: "expense", color: "#A855F7", icon: "shopping-bag" },
  { name: "Health", type: "expense", color: "#F43F5E", icon: "heart-pulse" },
  { name: "Subscriptions", type: "expense", color: "#EAB308", icon: "receipt" },
  { name: "Salary", type: "income", color: "#22C55E", icon: "briefcase-business" },
  { name: "Investment", type: "income", color: "#06B6D4", icon: "wallet-cards" },
  { name: "Travel", type: "expense", color: "#8B5CF6", icon: "plane" },
  { name: "Other", type: "expense", color: "#64748B", icon: "piggy-bank" }
] as const

export const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  "arrow-left-right": ArrowLeftRight,
  "briefcase-business": BriefcaseBusiness,
  "car-taxi-front": CarTaxiFront,
  "credit-card": CreditCard,
  "heart-pulse": HeartPulse,
  house: House,
  "piggy-bank": PiggyBank,
  plane: Plane,
  receipt: Receipt,
  "shopping-bag": ShoppingBag,
  "utensils-crossed": UtensilsCrossed,
  "wallet-cards": WalletCards
}

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/transactions", label: "Transactions" },
  { href: "/accounts", label: "Accounts" },
  { href: "/budgets", label: "Budgets" },
  { href: "/goals", label: "Goals" },
  { href: "/recurring", label: "Recurring" },
  { href: "/insights", label: "Insights" },
  { href: "/settings", label: "Settings" }
] as const
