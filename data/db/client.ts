import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';

import * as schema from './schema';

const DATABASE_NAME = 'gastos.db';

export const expoDb = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });

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
