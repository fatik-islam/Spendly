import { SettingsView } from "@/components/spendly/settings-view"
import { getSettingsPageData } from "@/lib/data"

export default async function SettingsPage() {
  const data = await getSettingsPageData()

  return <SettingsView {...data} />
}
