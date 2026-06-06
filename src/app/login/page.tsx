import { getPublicAuthConfig } from "@/lib/auth"
import { LoginForm } from "@/components/spendly/login-form"

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const authConfig = await getPublicAuthConfig()
  const params = await searchParams
  const authStatus = typeof params.insforge_status === "string" ? params.insforge_status : undefined
  const authType = typeof params.insforge_type === "string" ? params.insforge_type : undefined
  const authError = typeof params.insforge_error === "string" ? params.insforge_error : undefined

  return (
    <LoginForm
      authStatus={authStatus}
      authType={authType}
      authError={authError}
      passwordMinLength={authConfig.passwordMinLength}
    />
  )
}
