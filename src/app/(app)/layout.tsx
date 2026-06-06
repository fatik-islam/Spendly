import { AppShell } from "@/components/spendly/app-shell"
import { getAppShellData } from "@/lib/data"

export default async function ProtectedLayout({
  children
}: {
  children: React.ReactNode
}) {
  const { user, profile, reminderCenter } = await getAppShellData()

  return (
    <AppShell user={user} profile={profile} reminderCenter={reminderCenter}>
      {children}
    </AppShell>
  )
}
