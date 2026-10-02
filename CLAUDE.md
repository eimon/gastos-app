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
- DB-level tests use `test/dbPrueba.ts` (an expo-sqlite fake backed by `node:sqlite`), which needs **Node 22.5+**. Without it those suites skip with a warning; with `CI` set they fail.
- Never run `npm audit fix` (especially `--force`).

## Architecture

Layering, one direction only: `domain/` -> `data/` -> `services/` -> `hooks/` -> `app/` + `components/`.

| Layer | Role |
|-------|------|
| `domain/` | Pure TypeScript rules and math (cuotas, vencimientos, pagos, resumen, limits). Imports nothing from the app. |
| `data/` | `db/schema.ts`, `db/client.ts`, `DatabaseProvider` (runs migrations before rendering), `repositories/*Repo.ts` (Drizzle queries only). |
| `services/` | Orchestrate domain plans and repo writes inside one transaction; emit `cambios` events. Many files are DB-free helpers (`*Formulario`, `*Vista`, `*Edicion`, `orden`). |
| `hooks/` | `useServicio(fn, deps)` loads on focus and on `cambios`; never exposes data loaded for other deps. `useAlturaTeclado` lifts UI above the keyboard. |
| `app/`, `components/` | Screens and shared UI. Screens call services/hooks, never repos or Drizzle. |

The layering is a convention; ESLint does not enforce it.

Routes: tabs in `app/(tabs)/` (`index` = Gastos, `deudas`, `resumen`); `app/mis-gastos/` (new, `[id]`, `[id]/editar`), `app/deuda/` (nueva, `[id]`, `[id]/editar`), `app/tarjetas/`. Payments are a dialog (`DialogoPago`) inside the detail screens, not routes. `MonthContext` holds the selected month; lists filter by cuota due date.

## Data rules

- Money is integer cents (`Centavos`). Never use floats. Splits go through `dividirEnPartes`: the last part absorbs the remainder.
- Calendar dates are `'YYYY-MM-DD'` text, built from local date parts (`services/fechaLocal.ts`). Audit columns are ISO-UTC text.
- IDs are UUID text from `expo-crypto`. Every table has `created_at`, `updated_at` and `deleted_at` (soft delete). Every query must filter `deleted_at IS NULL` on gastos, deudas and pagos.
- Paid status is derived from the sum of live pagos, never stored. The user's own share is informational and cannot be paid.
- Limits live in `domain/limites.ts`: at most 30 cuotas, amount capped by `MAX_MONTO_CENTS`.
- Anything with a live pago cannot be deleted (anular the pago first) and only its description (gasto) or acreedor/description (deuda) stays editable.
- Order names in JS with `services/orden.ts`, never with SQL `COLLATE NOCASE` (ASCII only).
- Transactions with the expo-sqlite driver are synchronous: no `await` inside `db.transaction`. Repos take an `Executor` (`db` or `tx`).
- `PRAGMA foreign_keys = ON` is set in `data/db/client.ts`; tombstoned pagos must be purged before replacing the cuotas they reference.

## Migrations

- Edit `data/db/schema.ts`, then `npx drizzle-kit generate`. It writes `drizzle/NNNN_*.sql` and updates `drizzle/meta` and `drizzle/migrations.js`; commit all of them.
- Never edit or delete a migration that has shipped. Add a new one instead; keep changes additive.
- `.sql` files are bundled via `babel-plugin-inline-import` and the metro `sql` source extension. `useMigrations` runs pending migrations at startup.
- Do not run SQL by hand against a user's data; schema changes only go through generated migrations.

## Conventions

- Identifiers, file names, DB tables/columns (snake_case) and UI copy are Spanish (gasto, cuota, tarjeta, deuda, pago). Code comments, docs and commit messages are English. Keep extending it that way.
- UI copy uses impersonal or infinitive Spanish ("Tocar + para agregar", "No se pudo ..."), no voseo. Cancelling a payment is "Anular pago".
- Relative imports (the `@/*` alias maps to `app/*` only).
- Forms and actions show `err.message` only for rules errors (`esErrorDeReglas`); other errors are `console.error`-ed with a generic message.
- Every dependency must work in Expo Go (SDK 57): no custom native modules. Use `npx expo install` to add packages and `npx expo install --check` / `npx expo-doctor` to verify.
- Test files live next to each layer in `__tests__/`; `*.db.test.ts` and repo tests use `describeConSqlite`. Mutation-check boundary and guard tests.
- Conventional Commits; never commit `.env*` files or `.atl/`.
