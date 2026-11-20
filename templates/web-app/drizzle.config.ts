import { defineConfig } from 'drizzle-kit';

// `npm run db:generate` turns changes in src/server/db/schema.ts into a new SQL file in drizzle/.
// Review the SQL and commit it; the migration job applies it in Azure.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  casing: 'snake_case',
  strict: true,
  dbCredentials: {
    host: process.env.PGHOST ?? 'localhost',
    port: Number(process.env.PGPORT ?? 55432),
    database: process.env.PGDATABASE ?? 'app',
    user: process.env.PGUSER ?? 'postgres',
    ssl: false,
  },
});
