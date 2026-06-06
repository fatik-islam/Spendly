import { ResetPasswordFlow } from "@/components/spendly/reset-password-flow"
import { getPublicAuthConfig } from "@/lib/auth"

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const authConfig = await getPublicAuthConfig()
  const params = await searchParams
  const token = typeof params.token === "string" ? params.token : undefined
  const status = typeof params.insforge_status === "string" ? params.insforge_status : undefined
  const error = typeof params.insforge_error === "string" ? params.insforge_error : undefined

  return <ResetPasswordFlow token={token} status={status} error={error} passwordMinLength={authConfig.passwordMinLength} />
}
