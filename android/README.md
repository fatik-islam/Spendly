# Spendly for Android

Native Kotlin and Jetpack Compose client for the existing Spendly product. It uses the same InsForge project, schema, authentication sessions, row-level security, finance triggers, reminder data, and account-deletion endpoint as the web and iOS apps.

## Requirements

- Android Studio with JDK 17 or newer
- Android SDK 36
- A local Spendly InsForge anon key
- Firebase Android app configuration for production push notifications

## Local setup

1. Copy `local.properties.example` to `local.properties`.
2. Set `sdk.dir` and `SPENDLY_INSFORGE_ANON_KEY`.
3. Open the `android` directory in Android Studio, or build from the terminal:

```bash
./gradlew :app:assembleDebug
```

When `ios/Config/Local.xcconfig` exists, Gradle can reuse its local `INSFORGE_ANON_KEY`; the key is not copied into tracked source.

## Firebase push setup

1. Create or open the Firebase project intended for Spendly.
2. Register Android package `com.spendly.finance.app`.
3. Put its public project ID, app ID, API key, and sender ID in `android/local.properties`.
4. Create a Google service account with Firebase Cloud Messaging send permission.
5. Add the service account values to the InsForge reminder function as `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, and base64-encoded `FCM_PRIVATE_KEY_BASE64`.
6. Review and apply `migrations/20260822183000_add-fcm-push-notifications.sql`.
7. Redeploy `functions/sync-recurring-reminders.ts`.

The app compiles without Firebase values. FCM initialization and token registration activate only when all four public values are present.

## Product parity

- Animated single-logo launch experience
- Sign in, sign up, email verification, reset password, show-password, and Remember Me
- Secure encrypted session persistence through Android Keystore
- The same five-tab information architecture as iOS: Overview, Ledger, Accounts, Budgets, and More
- Dashboard charts and sections, ledger filters, account transfers, budget warnings, savings goals, recurring summaries, insights, reminders, settings, and categories
- Full create/edit/delete operations using the existing InsForge rows and balance triggers
- Light, dark, and system appearance modes
- Dataset-specific CSV export and guarded transaction CSV import
- FCM push receiver and notification permission flow
- Support and privacy links on `https://spendly.syedfatikislam.com`
- Sign out and permanent account/data deletion

## Release

The package ID is `com.spendly.finance.app`, `minSdk` is 26, and `targetSdk` is 36. Configure a Play App Signing upload key before generating the production Android App Bundle:

```bash
./gradlew :app:bundleRelease
```
