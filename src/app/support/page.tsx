import type { Metadata } from "next"

import { LegalPage } from "@/components/spendly/legal-page"

export const metadata: Metadata = {
  title: "Support | Spendly",
  description: "Get help with your Spendly account, data, reminders, and mobile apps."
}

export default function SupportPage() {
  return (
    <LegalPage
      eyebrow="Spendly support"
      title="How can we help?"
      introduction="For account, data, import, reminder, or mobile app questions, contact us and include a short description of what happened."
    >
      <section>
        <h2>Contact support</h2>
        <p>
          Email <a href="mailto:syedfatikislamm@gmail.com">syedfatikislamm@gmail.com</a>. Please do not send passwords, verification codes, complete financial exports, or other sensitive information by email.
        </p>
      </section>

      <section>
        <h2>Account access</h2>
        <p>Use “Forgot password?” on the sign-in screen to request a secure reset code. If verification or reset email does not arrive, check spam and confirm the email address was entered correctly before contacting support.</p>
      </section>

      <section>
        <h2>Push notifications</h2>
        <p>In Spendly, open More → Settings and enable App notifications. If notifications remain unavailable, open your device settings: on iOS choose Notifications → Spendly; on Android choose Apps → Spendly → Notifications. Allow notifications and sounds, then reopen Spendly.</p>
      </section>

      <section>
        <h2>Delete your account</h2>
        <p>Open More → Settings → Delete account and data. Confirming deletion permanently removes your Spendly login and associated workspace data. If you cannot access the app, use our <a href="/account-deletion">web account-deletion request</a>. Deletion cannot be undone.</p>
      </section>

      <section>
        <h2>Response time</h2>
        <p>We aim to respond to support requests within two business days.</p>
      </section>
    </LegalPage>
  )
}
