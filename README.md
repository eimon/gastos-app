# Gastos App

Offline, single-user expense tracker for Android. Track credit cards, personal and shared expenses split into installments (cuotas), debts you owe, payments, and a monthly summary. Everything is stored on the device in SQLite; there is no account, server or network requirement.

## Quick path

Requirements: Node 22.13+ and the Expo Go app (SDK 57) on an Android device or emulator.

```bash
npm install
npm start          # scan the QR code with Expo Go
```

No `.env` file or other configuration is needed.

## Features

| Area | What it does |
|------|--------------|
| Tarjetas | Create, edit and archive cards (closing and due day) |
| Gastos | Personal or shared expenses, cuotas, optional discount, custom per-person amounts, edit and delete |
| Deudas | Money you owe, with a cuota schedule per creditor |
| Pagos | Register partial or full payments (cash or transfer) and cancel them |
| Resumen | Per month: card totals, what others owe you, what you owe, and your own expenses |

## Commands

```bash
npm start                  # Expo dev server
npm run android            # native Android build (expo run:android)
npm test                   # Jest: domain, services and data tests
npx tsc --noEmit           # type-check
npm run lint               # ESLint through expo lint
npx drizzle-kit generate   # generate a migration after changing data/db/schema.ts
```

DB-level tests run against `node:sqlite` and need Node 22.13+. Without it they are skipped locally and fail when `CI` is set.

## Project structure

```
domain/      pure rules and math (money in integer cents)
data/        Drizzle schema, DB client, repositories
services/    use cases: domain plans + repository writes in one transaction
hooks/       useServicio and keyboard helpers
lib/         shared helpers (ejecutar.ts, alerts.ts)
contexts/    React contexts (MonthContext: selected month)
types/       ambient type declarations
app/         expo-router screens (tabs: Gastos, Deudas, Resumen)
components/  shared UI (forms, payment dialog)
drizzle/     generated SQL migrations
test/        SQLite test harness (not bundled)
```

Dependencies flow one way: `domain` -> `data` -> `services` -> `hooks` -> `app` / `components`. See [CLAUDE.md](CLAUDE.md) for the conventions and [DATABASE_RULES.md](DATABASE_RULES.md) for migration rules.

## Building with EAS

`eas.json` defines `development`, `preview` and `production` profiles. No environment variables or secrets are required.

```bash
npm install -g eas-cli
eas build --platform android --profile preview   # installable internal build
```
