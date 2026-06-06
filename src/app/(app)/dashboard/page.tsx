import { getDashboardSnapshot } from "@/lib/data"
import { DashboardView } from "@/components/spendly/dashboard-view"

export default async function DashboardPage() {
  const snapshot = await getDashboardSnapshot()

  return <DashboardView snapshot={snapshot} />
}
