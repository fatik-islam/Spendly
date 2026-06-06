import { getPublicAuthConfig } from "@/lib/auth"
import { SignupFlow } from "@/components/spendly/signup-flow"

export default async function SignupPage() {
  const authConfig = await getPublicAuthConfig()

  return <SignupFlow passwordMinLength={authConfig.passwordMinLength} verifyEmailMethod={authConfig.verifyEmailMethod} />
}
