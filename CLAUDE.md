# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## Project

Offline, single-user expense tracker for Android. Expo SDK 57 / React Native 0.86 / expo-router / React Native Paper. All data lives on the device in SQLite (`expo-sqlite` + `drizzle-orm`). There is no backend, no auth and no `.env`. Web is not supported; iOS may come later (`ios` script and `app.json` block are kept).

It tracks: tarjetas (credit cards), gastos (personal or shared, split into cuotas), deudas (money the user owes), pagos (payments against shares or cuotas) and a monthly Resumen.

## Commands

```bash
npm start                  # Expo dev server (open in Expo Go)
npm run android            # expo run:android (native build)
npm test                   # jest (domain, services, data)
npx tsc --noEmit           # type-check (no script defined)
npm run lint               # expo lint over app components domain data services hooks lib contexts types test
npx drizzle-kit generate   # generate a migration after editing data/db/schema.ts
```

- Run lint with `npx expo lint --no-cache ...` when `import/no-unresolved` looks stale.
- DB-level tests use `test/dbPrueba.ts` (an expo-sqlite fake backed by `node:sqlite`), which needs **Node 22.13+**. Without it those suites skip with a warning; with `CI` set they fail.
- Never run `npm audit fix` (especially `--force`).

## Architecture

Layering, one direction only: `domain/` -> `data/` -> `services/` -> `hooks/` -> `app/` + `components/`.

| Layer | Role |
|-------|------|
| `domain/` | Pure TypeScript rules and math (cuotas, vencimientos, pagos, resumen, limits). Imports nothing from the app. |
| `data/` | `db/schema.ts`, `db/client.ts`, `DatabaseProvider` (runs migrations before rendering), `repositories/*Repo.ts` (Drizzle queries only). |
| `services/` | Orchestrate domain plans and repo writes inside one transaction; emit `cambios` events. Many files are DB-free helpers (`*Formulario`, `*Vista`, `*Edicion`, `orden`). |
| `hooks/` | `useServicio(fn, deps)` loads on focus and on `cambios`; never exposes data loaded for other deps. `useAlturaTeclado` lifts UI above the keyboard. |
| `lib/` | Small shared helpers: `ejecutar.ts` (action runner), `alerts.ts` (alert dialogs). |
| `contexts/` | React contexts; `MonthContext` holds the selected month. |
| `types/` | Ambient type declarations (`global.d.ts`). |
| `app/`, `components/` | Screens and shared UI. Screens call services/hooks, never repos or Drizzle. |

The layering is a convention; ESLint does not enforce it.

Routes: tabs in `app/(tabs)/` (`index` = Gastos, `deudas`, `resumen`); `app/mis-gastos/` (new, `[id]`, `[id]/editar`), `app/deuda/` (nueva, `[id]`, `[id]/editar`), `app/tarjetas/`. Payments are a dialog (`DialogoPago`) inside the detail screens, not routes. `MonthContext` holds the selected month; lists filter by cuota due date.

## Data rules and migrations

Single source: [DATABASE_RULES.md](DATABASE_RULES.md). Summary: money is integer cents, dates are `YYYY-MM-DD` text, every table is soft-deleted (filter `deleted_at IS NULL`), and transactions are synchronous. Schema changes go only through `npx drizzle-kit generate`; never edit a migration that has shipped. Read DATABASE_RULES.md before touching `data/` or `drizzle/`.

## Conventions

- Identifiers, file names, DB tables/columns (snake_case) and UI copy are Spanish (gasto, cuota, tarjeta, deuda, pago). New comments, docs and commit messages are in English; some older file-header comments are still in Spanish.
- UI copy uses impersonal or infinitive Spanish ("Tocar + para agregar", "No se pudo ..."), no voseo. Cancelling a payment is "Anular pago".
- Relative imports (the `@/*` alias maps to `app/*` only).
- Forms and actions show `err.message` only for rules errors (`esErrorDeReglas`); other errors are `console.error`-ed with a generic message.
- Every dependency must work in Expo Go (SDK 57): no custom native modules. Use `npx expo install` to add packages and `npx expo install --check` / `npx expo-doctor` to verify.
- Test files live next to each layer in `__tests__/`; `*.db.test.ts` and repo tests use `describeConSqlite`. Mutation-check boundary and guard tests.
- Conventional Commits; never commit `.env*` files or `.atl/`.
