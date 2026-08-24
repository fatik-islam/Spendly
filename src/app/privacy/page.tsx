import type { Metadata } from "next"

import { LegalPage } from "@/components/spendly/legal-page"

export const metadata: Metadata = {
  title: "Privacy Policy | Spendly",
  description: "How Spendly collects, uses, protects, and deletes personal and financial information."
}

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Effective August 24, 2026"
      title="Privacy Policy"
      introduction="Spendly is a personal finance workspace. This policy explains the information needed to operate your account and how you remain in control of it."
    >
      <section>
        <h2>Information you provide</h2>
        <p>We process the information you choose to add to Spendly, including:</p>
        <ul>
          <li>Account information such as your name and email address.</li>
          <li>Financial records such as account names, balances, transactions, budgets, savings goals, categories, and recurring items.</li>
          <li>Preferences such as currency, theme, reminder timing, and notification choices.</li>
        </ul>
        <p>Spendly does not connect to your bank, access bank credentials, sell personal information, or use your information for advertising.</p>
      </section>

      <section>
        <h2>Device and notification information</h2>
        <p>
          If you enable push notifications, the Spendly mobile app receives a device token and securely associates it with your account. The token is used only to deliver reminders you requested. Apple processes iOS notifications through Apple Push Notification service, and Google processes Android notifications through Firebase Cloud Messaging.
        </p>
      </section>

      <section>
        <h2>How information is used</h2>
        <p>We use your information to authenticate you, display and synchronize your workspace, calculate financial summaries, import or export data at your request, deliver reminders, provide support, and protect the service from abuse.</p>
      </section>

      <section>
        <h2>Service providers and disclosure</h2>
        <p>
          Spendly uses InsForge for authentication, database hosting, email delivery, and application infrastructure; Vercel for web hosting; Apple Push Notification service for enabled iOS notifications; and Google Firebase Cloud Messaging for enabled Android notifications. These providers process information only as needed to deliver their services. We may also disclose information when required by law or to protect users and the service.
        </p>
      </section>

      <section>
        <h2>No tracking or advertising</h2>
        <p>Spendly does not use third-party advertising, cross-app tracking, data brokers, or third-party product analytics.</p>
      </section>

      <section>
        <h2>Retention and deletion</h2>
        <p>
          We retain your account information and workspace data while your account is active. You can permanently delete your account and associated Spendly data in the mobile app under More → Settings → Delete account and data, or submit a verified request through our <a href="/account-deletion">account-deletion page</a>.
        </p>
      </section>

      <section>
        <h2>Security</h2>
        <p>Spendly uses encrypted network connections, authenticated access, Apple Keychain storage on iOS, Android Keystore-backed encrypted session storage, and database row-level security. No system can guarantee absolute security, but we apply safeguards appropriate to the information processed.</p>
      </section>

      <section>
        <h2>Children</h2>
        <p>Spendly is not directed to children under 13, and we do not knowingly collect personal information from children under 13.</p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>We may update this policy when the service changes. The effective date above identifies the latest version.</p>
        <p>
          Privacy questions can be sent to <a href="mailto:syedfatikislamm@gmail.com">syedfatikislamm@gmail.com</a>.
        </p>
      </section>
    </LegalPage>
  )
}
