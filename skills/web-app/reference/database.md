# PostgreSQL with Drizzle

## Connection

- `src/server/db/client.ts` connects with the `PG*` settings. In Azure (`APP_ENVIRONMENT` set) the
  password is an Entra token for the managed identity, fetched per connection, with TLS verified;
  locally it connects to the docker compose database without a password.
- The app's role has data access only: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, and only `SELECT`
  and `INSERT` on `audit_log`. It cannot create or alter tables.

## Changing the schema

1. Edit `src/server/db/schema.ts` (camelCase keys become snake_case columns).
2. `npm run db:generate -- --name <what-changed>` writes a SQL file in `drizzle/`. Read it.
3. `npm run db:migrate` applies it locally; commit the SQL and `drizzle/meta`.
4. In Azure the migration job runs `node dist/migrate.js` from the same image before the new
   version starts, under its own identity, and grants data access to `DB_RUNTIME_ROLES`.

Rules: no `CREATE EXTENSION` (use `gen_random_uuid()` for ids), never migrate at startup, never
edit an applied migration (add a new one), and keep changes backward compatible for one release
(the old version runs while the new one starts).

## Writes and audit

```ts
await app.db.transaction(async (tx) => {
  const [row] = await tx.update(projects).set({ name }).where(eq(projects.id, id)).returning();
  if (!row) throw notFound('The project');
  await writeAudit(tx, { actorId: user.id, action: 'update', entity: 'project', entityId: id, detail: { fields: ['name'] } });
});
```

- Every change writes an audit row in the **same transaction**.
- Record ids and field names in `detail`, not values that may be personal data.
- Red zone: also record who **read** personal data, and support retention and erasure.

## Data

- Seed, demo and test data are synthetic. Never a copy of production data.
- Query with Drizzle's builder or `sql` template literals: both parameterize. Never build SQL by
  string concatenation with input.
- Lists are paged or limited (`.limit()`); large tables get indexes in the schema.
