import { getTransactionsPageData } from "@/lib/data"
import { TransactionsView } from "@/components/spendly/transactions-view"

export default async function TransactionsPage() {
  const data = await getTransactionsPageData()

  return <TransactionsView {...data} />
}
