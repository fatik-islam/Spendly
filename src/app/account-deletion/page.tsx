import type { Metadata } from "next"

import { LegalPage } from "@/components/spendly/legal-page"

const supportEmail = "syedfatikislamm@gmail.com"
const deletionRequestHref = `mailto:${supportEmail}?subject=${encodeURIComponent("Spendly account deletion request")}`

export const metadata: Metadata = {
  title: "Delete Your Account | Spendly",
  description: "Request permanent deletion of your Spendly account and associated data."
}

export default function AccountDeletionPage() {
  return (
    <LegalPage
      eyebrow="Account and data controls"
      title="Delete your Spendly account"
      introduction="You can permanently delete your Spendly login and all associated workspace data from the mobile app or by sending us a verified web request."
    >
      <section>
        <h2>Delete immediately in the app</h2>
        <p>Sign in to Spendly, open More → Settings → Delete account and data, and complete both confirmation steps. The deletion is permanent and signs you out on every platform.</p>
      </section>

      <section>
        <h2>Request deletion without the app</h2>
        <p>
          Email us from the address connected to your Spendly account using the link below. Use the subject “Spendly account deletion request” and state that you want your account and associated data permanently deleted.
        </p>
        <p><a href={deletionRequestHref}>Send an account-deletion request to {supportEmail}</a>.</p>
        <p>If you no longer have access to the account email, include that email address and explain the access issue so we can verify ownership safely. Never send your password, verification code, or financial export.</p>
      </section>

      <section>
        <h2>Data that is deleted</h2>
        <p>Deletion removes your Spendly login, profile, accounts, categories, transactions, budgets, savings goals, recurring items, reminders, and registered mobile notification tokens. This cannot be undone.</p>
      </section>

      <section>
        <h2>Verification and confirmation</h2>
        <p>We verify requests to protect accounts from unauthorized deletion. Once a request is verified and completed, we confirm deletion by email. Limited records may be retained only when required for legal, security, or fraud-prevention obligations.</p>
      </section>
    </LegalPage>
  )
}
