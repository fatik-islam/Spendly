# Spendly

Spendly is a modern personal finance tracker built with Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui-style components, Recharts, Zod, and InsForge for authentication, database, backend access, and deployment.

## Features

- InsForge authentication with sign up, sign in, sign out, password reset, protected routes, and profile settings
- Dashboard with total balance, monthly income/expenses, net savings, trend charts, budget states, savings goals, recent transactions, and recurring reminders
- Transactions with search, filters, notes, recurring flag, edit/delete flows, and account transfers
- Accounts for cash, bank, credit card, and savings balances
- Budgets with progress tracking, 80% warning states, and exceeded alerts
- Savings goals with target tracking and deadlines
- Recurring payments with weekly, monthly, and yearly cadence, a reminder inbox, and optional email alerts
- Insights for income vs expense comparison, top spending categories, savings rate, and financial health score
- Settings for profile updates, currency selection, true light/dark/system theme switching, reminder preferences, category management, CSV import, per-dataset CSV exports, and one-click demo data

## Stack

- Next.js 15 App Router
- TypeScript
- Tailwind CSS 3.4
- shadcn/ui-style component system
- Recharts
- Zod + React Hook Form
- InsForge SDK + InsForge CLI

## Environment variables

Copy `.env.example` to `.env.local` and set:

```bash
NEXT_PUBLIC_INSFORGE_URL=https://your-project.us-east.insforge.app
NEXT_PUBLIC_INSFORGE_ANON_KEY=your-insforge-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

If this repo is already linked to InsForge, `.env.local` can be populated from:

- `.insforge/project.json` → `oss_host`
- `npx @insforge/cli secrets get ANON_KEY`

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Apply the database migration:

```bash
npx @insforge/cli db migrations up --all
```

3. Apply auth redirect URL configuration:

```bash
npx @insforge/cli config apply --file insforge.toml --auto-approve
```

4. Start the app:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

6. Run the unit tests:

```bash
npm run test:unit
```

Optional local reminder worker setup:

```bash
npx @insforge/cli functions deploy sync-recurring-reminders --file functions/sync-recurring-reminders.ts --name "Sync recurring reminders" --description "Generates reminder rows and sends reminder emails"
```

## InsForge project setup

For a new repo:

```bash
npx @insforge/cli create --json --name Spendly --org-id <org-id> --region us-east --template empty
```

For an existing project:

```bash
npx @insforge/cli link
```

## Deployment with InsForge

1. Make sure deployment env vars exist:

```bash
npx @insforge/cli deployments env set NEXT_PUBLIC_INSFORGE_URL https://your-project.us-east.insforge.app
npx @insforge/cli deployments env set NEXT_PUBLIC_INSFORGE_ANON_KEY your-insforge-anon-key
npx @insforge/cli deployments env set NEXT_PUBLIC_APP_URL https://spendly.syedfatikislam.com
npx @insforge/cli deployments env set INSFORGE_API_KEY your-insforge-api-key
```

`INSFORGE_API_KEY` is server-only and powers the authenticated account-deletion route. Never expose it through a `NEXT_PUBLIC_` variable.

2. Make sure `insforge.toml` includes your deployed login URL in `auth.allowed_redirect_urls`.

3. Re-apply auth config:

```bash
npx @insforge/cli config apply --file insforge.toml --auto-approve
```

4. Build locally:

```bash
npm run build
```

5. Run the unit suite:

```bash
npm run test:unit
```

6. Deploy the recurring reminder worker and background schedule:

```bash
npx @insforge/cli secrets add SPENDLY_INSFORGE_BASE_URL https://your-project.us-east.insforge.app
npx @insforge/cli secrets add SPENDLY_INSFORGE_API_KEY your-insforge-api-key
npx @insforge/cli secrets add REMINDER_SCHEDULE_TOKEN your-random-token
npx @insforge/cli functions deploy sync-recurring-reminders --file functions/sync-recurring-reminders.ts --name "Sync recurring reminders" --description "Generates reminder rows and sends reminder emails"
npx @insforge/cli schedules create --name "Spendly recurring reminders" --cron "0 8 * * *" --url "https://your-project.us-east.insforge.app/functions/sync-recurring-reminders" --method POST --headers '{"X-Reminder-Token":"${{secrets.REMINDER_SCHEDULE_TOKEN}}"}'
```

If the schedule already exists, use `npx @insforge/cli schedules update <id> ...` instead of creating a second one.

7. Deploy the frontend:

```bash
npx @insforge/cli deployments deploy .
```

Current production URL:

- [https://spendly.syedfatikislam.com](https://spendly.syedfatikislam.com)

## Data model

The app includes InsForge-backed tables for:

- `profiles`
- `accounts`
- `categories`
- `transactions`
- `budgets`
- `savings_goals`
- `recurring_transactions`
- `recurring_reminders`

The schema is defined in:

- `migrations/20260604143000_create-spendly-finance-schema.sql`
- `migrations/20260605101500_add-recurring-reminders.sql`
- `migrations/20260605101505_add-demo-workspace-rpc.sql`

## Notes

- User data is protected by both app-level ownership checks and Postgres RLS through `auth.uid()`.
- Default accounts and categories are bootstrapped per user through the `bootstrap_spendly_user` RPC.
- Account balances stay in sync automatically via a database trigger on `transactions`.
- Reminder emails use InsForge custom email from the scheduled edge function. In-app reminders work without email; email delivery requires an InsForge paid plan.
- Demo workspace loading is intentionally limited to empty workspaces so sample data can’t overwrite a real ledger.
