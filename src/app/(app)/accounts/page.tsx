import { AccountsView } from "@/components/spendly/accounts-view"
import { getAccountsPageData } from "@/lib/data"

export default async function AccountsPage() {
  const data = await getAccountsPageData()

  return <AccountsView {...data} />
}
