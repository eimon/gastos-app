import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';

import * as schema from './schema';

const DATABASE_NAME = 'gastos.db';

export const expoDb = openDatabaseSync(DATABASE_NAME);

// SQLite disables foreign-key enforcement per-connection by default. Without
// this pragma, every `.references()` in schema.ts is decorative only — SQLite
// would silently accept an insert/update that violates a foreign key. Must
// run before any other statement on this connection. This can't be exercised
// in Jest (no native SQLite there); it's verified manually — see the Expo Go
// checklist in the PR 2 apply-progress notes ("foreign keys enforced" step).
expoDb.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(expoDb, { schema });

export type Database = typeof db;

/** The `tx` argument `db.transaction((tx) => ...)` passes to its callback. */
type TransactionCallback = Parameters<Database['transaction']>[0];
export type Transaction = Parameters<TransactionCallback>[0];

/**
 * Repos accept either the top-level `db` or a `tx` from `db.transaction(...)`
 * so services can compose multiple repo writes into one atomic transaction.
 * The expo-sqlite driver runs in sync mode: transaction callbacks MUST be
 * synchronous (no `await` inside), so repo write methods execute queries
 * with `.run()`/`.get()`/`.all()` rather than relying on the thenable form.
 */
export type Executor = Database | Transaction;
