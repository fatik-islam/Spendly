import { InsightsView } from "@/components/spendly/insights-view"
import { getInsightsPageData } from "@/lib/data"

export default async function InsightsPage() {
  const data = await getInsightsPageData()

  return <InsightsView {...data} />
}
