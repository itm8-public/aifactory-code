import { loadDbConfig } from '../config';
import { runMigrations } from '../db/migrate';

// Applies the migrations to the test database once before the test files run.
// Locally: `npm run db:up` first (docker compose creates app_test). In CI: a postgres service.
export default async function setup() {
  await runMigrations(
    loadDbConfig({
      PGHOST: process.env.PGHOST ?? 'localhost',
      PGPORT: process.env.PGPORT ?? '55432',
      PGDATABASE: process.env.PGDATABASE_TEST ?? 'app_test',
      PGUSER: process.env.PGUSER ?? 'postgres',
    }),
  );
}
