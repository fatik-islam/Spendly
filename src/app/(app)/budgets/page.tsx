import { BudgetsView } from "@/components/spendly/budgets-view"
import { getBudgetsPageData } from "@/lib/data"

export default async function BudgetsPage() {
  const data = await getBudgetsPageData()

  return <BudgetsView {...data} />
}
