export const EXPORT_DATASETS = [
  {
    value: "profile",
    label: "Profile",
    description: "Profile details, currency, and reminder preferences."
  },
  {
    value: "accounts",
    label: "Accounts",
    description: "Account balances, account types, and currencies."
  },
  {
    value: "categories",
    label: "Categories",
    description: "Default and custom category labels, colors, and icons."
  },
  {
    value: "transactions",
    label: "Transactions",
    description: "Full transaction ledger with notes, transfers, and recurring flags."
  },
  {
    value: "budgets",
    label: "Budgets",
    description: "Monthly category budgets and period settings."
  },
  {
    value: "goals",
    label: "Savings goals",
    description: "Goal targets, current balances, and deadlines."
  },
  {
    value: "recurring",
    label: "Recurring",
    description: "Recurring bills, income cycles, and next due dates."
  }
] as const

export type ExportDataset = (typeof EXPORT_DATASETS)[number]["value"]

export const DEFAULT_EXPORT_DATASET: ExportDataset = "transactions"

export function isExportDataset(value: string | null | undefined): value is ExportDataset {
  return EXPORT_DATASETS.some((dataset) => dataset.value === value)
}
