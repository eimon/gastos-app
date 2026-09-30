/**
 * Jest-only harness that lets the REAL drizzle client, repositories and services run
 * against an in-memory SQLite: `expo-sqlite` is replaced by `node:sqlite` (Node 22.5+),
 * foreign keys are ON (like the app) and the real drizzle migrations are applied.
 * It lives outside app/, components/, services/ and the other app folders, so the app bundle
 * never imports it.
 *
 * Usage in a test file (babel-jest hoists jest.mock above the imports):
 *   jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('crypto').randomUUID() }));
 *   jest.mock('expo-sqlite', () => jest.requireActual('../../test/dbPrueba').expoSqliteFalso());
 *   import { describeConSqlite } from '../../test/dbPrueba';
 */
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

export function hayNodeSqlite(): boolean {
  try {
    require('node:sqlite');
    return true;
  } catch {
    return false;
  }
}

/**
 * `describe` when node:sqlite exists. Otherwise the suite is skipped with a clear message, except in CI
 * (`process.env.CI` set), where it FAILS so the missing coverage can never go unnoticed.
 */
export const describeConSqlite: typeof describe = ((nombre: string, fn: () => void) => {
  if (hayNodeSqlite()) {
    return describe(nombre, fn);
  }
  if (process.env.CI) {
    return describe(nombre, () => {
      test('node:sqlite is required in CI', () => {
        throw new Error(`"${nombre}" needs node:sqlite (Node 22.5 or newer) and cannot be skipped in CI.`);
      });
    });
  }
  console.warn(`Skipping "${nombre}": node:sqlite is unavailable (needs Node 22.5 or newer).`);
  return describe.skip(nombre, fn);
}) as typeof describe;

/** Factory for `jest.mock('expo-sqlite', ...)`. */
export function expoSqliteFalso() {
  if (!hayNodeSqlite()) {
    // Importing the client must not crash; every suite that needs a database is skipped.
    return { openDatabaseSync: () => ({ execSync: () => undefined }) };
  }

  const { DatabaseSync } = require('node:sqlite');
  const fs = require('fs');
  const path = require('path');

  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON;');
  const carpeta = path.join(process.cwd(), 'drizzle');
  for (const archivo of fs.readdirSync(carpeta).filter((f: string) => f.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(carpeta, archivo), 'utf8');
    for (const sentencia of sql.split('--> statement-breakpoint')) {
      if (sentencia.trim()) raw.exec(sentencia);
    }
  }

  const normalizar = (params: any[]) => params.map((v) => (v === undefined ? null : v));

  return {
    openDatabaseSync: () => ({
      execSync: (sql: string) => raw.exec(sql),
      prepareSync: (sql: string) => {
        const st = raw.prepare(sql);
        const rawSt = raw.prepare(sql);
        rawSt.setReturnArrays(true);
        return {
          executeSync: (params: any[]) => {
            if (/^\s*(select|with)/i.test(sql) || /returning/i.test(sql)) {
              return {
                changes: 0,
                lastInsertRowId: 0,
                getAllSync: () => st.all(...normalizar(params)),
                getFirstSync: () => st.get(...normalizar(params)),
              };
            }
            const r = st.run(...normalizar(params));
            return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
          },
          executeForRawResultSync: (params: any[]) => ({ getAllSync: () => rawSt.all(...normalizar(params)) }),
        };
      },
    }),
  };
}
