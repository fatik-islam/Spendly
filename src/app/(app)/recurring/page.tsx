import { RecurringView } from "@/components/spendly/recurring-view"
import { getRecurringPageData } from "@/lib/data"

export default async function RecurringPage() {
  const data = await getRecurringPageData()

  return <RecurringView {...data} />
}
