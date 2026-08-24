# Spendly for iOS

Spendly is a native SwiftUI app for iPhone and iPad. It uses the same production InsForge project and database as the web app.

## Requirements

- Xcode 26 or newer for the Liquid Glass appearance
- iOS 17 or newer deployment target
- The local InsForge anonymous key from the repository's `.env.local`

## Configure and run

1. Open `Spendly.xcodeproj` in Xcode.
2. Select the **Spendly** target, then **Build Settings**.
3. Ensure the repository's ignored `.env.local` contains `NEXT_PUBLIC_INSFORGE_ANON_KEY`.
4. Run `ios/Config/sync-local-config.sh` whenever `.env.local` changes. It creates the ignored Xcode configuration from the existing value.
5. Choose an iPhone simulator and run the **Spendly** scheme.

Do not commit `Config/Local.xcconfig`. For simulator automation, the app also accepts the process environment variable `SPENDLY_INSFORGE_ANON_KEY`.

## Architecture

- `Auth/` contains sign-in, sign-up, email verification, and password-reset flows.
- `Core/` contains the InsForge REST client, Keychain session storage, models, shared state, formatting, and CSV import/export.
- `Core/NotificationService.swift` schedules recurring reminders as native iOS banners with sound and app-icon badges. Permission is requested only after authentication.
- `Features/` contains the complete native finance workspace: dashboard, ledger, accounts, budgets, goals, recurring items, insights, and settings.
- `Design/` contains the Spendly visual system. iOS 26 uses native Liquid Glass APIs; iOS 17–25 use material-backed fallbacks.

The app never stores the InsForge anonymous key in source control. User access and refresh tokens are stored in the iOS Keychain. Permanent deletion is confirmed twice in Settings, authenticated with the current user token, and completed through Spendly's server-only route so the InsForge admin key never enters the app.
