import { ForgotPasswordFlow } from "@/components/spendly/forgot-password-flow"
import { getPublicAuthConfig } from "@/lib/auth"

export default async function ForgotPasswordPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const authConfig = await getPublicAuthConfig()
  const params = await searchParams
  const prefilledEmail = typeof params.email === "string" ? params.email : undefined

  return (
    <ForgotPasswordFlow
      prefilledEmail={prefilledEmail}
      passwordMinLength={authConfig.passwordMinLength}
      resetPasswordMethod={authConfig.resetPasswordMethod}
    />
  )
}
