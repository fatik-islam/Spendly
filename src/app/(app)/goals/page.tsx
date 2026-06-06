import { GoalsView } from "@/components/spendly/goals-view"
import { getGoalsPageData } from "@/lib/data"

export default async function GoalsPage() {
  const data = await getGoalsPageData()

  return <GoalsView {...data} />
}
