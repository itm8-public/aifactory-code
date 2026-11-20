import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { loadDbConfig, type DbConfig } from '../config';
import { createDb } from './client';

/**
 * Applies the SQL migrations in drizzle/. In Azure this runs as its own Container Apps job with
 * its own identity (the schema owner) before each deploy: `node dist/migrate.js`. The running app
 * never migrates; its identity gets data access only, granted here to every role in
 * DB_RUNTIME_ROLES, and only SELECT and INSERT on audit_log.
 */
export async function runMigrations(config: DbConfig) {
  const { db, sql } = createDb({ ...config, DB_POOL_MAX: 1 });
  const migrationsFolder = path.resolve(process.env.MIGRATIONS_FOLDER ?? 'drizzle');
  try {
    await migrate(db, { migrationsFolder });
    for (const name of config.DB_RUNTIME_ROLES) {
      if (!/^[A-Za-z0-9 _.@-]{1,63}$/.test(name)) {
        throw new Error('DB_RUNTIME_ROLES holds a role name with unexpected characters');
      }
      const role = sql(name);
      // An admin may own the schema; then the grant already exists and the migrator cannot give it.
      const [schema] = await sql<{ ok: boolean }[]>`
        select has_schema_privilege(${name}, 'public', 'USAGE') as ok`;
      if (!schema?.ok) await sql`grant usage on schema public to ${role}`;
      await sql`grant select, insert, update, delete on all tables in schema public to ${role}`;
      await sql`grant usage, select on all sequences in schema public to ${role}`;
      await sql`revoke update, delete, truncate on audit_log from ${role}`;
      await sql`alter default privileges in schema public grant select, insert, update, delete on tables to ${role}`;
      await sql`alter default privileges in schema public grant usage, select on sequences to ${role}`;
    }
  } finally {
    await sql.end();
  }
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  runMigrations(loadDbConfig())
    .then(() => {
      console.log('Migrations applied');
      process.exit(0);
    })
    .catch((err: unknown) => {
      console.error(err instanceof Error ? err.message : 'Migration failed');
      process.exit(1);
    });
}
