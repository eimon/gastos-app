# Database rules

The database is a local SQLite file (`gastos.db`) managed with Drizzle. The schema lives in `data/db/schema.ts`; migrations are generated into `drizzle/`.

## Changing the schema

1. Edit `data/db/schema.ts`.
2. Run `npx drizzle-kit generate`. It adds `drizzle/NNNN_*.sql`, updates `drizzle/meta/` and rewrites `drizzle/migrations.js`.
3. Review the generated SQL and commit all of the generated files together with the schema change.
4. Start the app: `DatabaseProvider` runs pending migrations before rendering and shows an error with a retry action if one fails.

## Rules

| Rule | Reason |
|------|--------|
| Never edit, rename or delete a migration that has shipped | Installed apps already applied it; the journal must stay consistent |
| Prefer additive changes (new tables, nullable or defaulted columns) | SQLite has limited `ALTER TABLE`; users have data on their devices |
| Do not write SQL by hand outside generated migrations | Keeps `schema.ts`, the journal and the SQL in sync |
| Every table has `id` (UUID text), `created_at`, `updated_at`, `deleted_at` | Soft delete; sync-ready |
| Money is integer cents; calendar dates are `YYYY-MM-DD` text | Exact sums, no timezone drift |
| Filter `deleted_at IS NULL` in every query on gastos, deudas and pagos | Soft-deleted rows must never surface |
| Foreign keys are enforced (`PRAGMA foreign_keys = ON` in `data/db/client.ts`) | Purge tombstoned pagos before replacing the cuotas they reference |
| Transactions are synchronous with the expo-sqlite driver | No `await` inside `db.transaction` |
| Order text in JS (`services/orden.ts`), not with `COLLATE NOCASE` | SQLite folds ASCII only |

## Testing

Repository and service DB tests run on `node:sqlite` through `test/dbPrueba.ts` (Node 22.5+) and apply every `drizzle/*.sql` file, so a broken migration fails the suite. Expo Go still needs a manual check for a fresh install and for upgrading from the previous migration.
