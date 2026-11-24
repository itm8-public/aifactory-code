---
name: web-app
description: Build or change an AI Factory web app made by aifactory-code - one container where Fastify 5 and TypeScript serve a React/Vite front end and /api routes, Easy Auth sign-in, PostgreSQL through Drizzle with Entra tokens, migrations as a separate command, optional Azure AI Foundry calls. Use for pages, API routes, tables, roles, settings, logging, AI features or tests in a repository whose .aifactory/build-profile.json lists a web app, or when someone asks for a portal, dashboard or internal tool on AI Factory.
---

# Work on an AI Factory web app

The app is one container (`web`): Fastify serves the built React front end and the `/api` routes
from the same origin, on port 8080. Easy Auth signs users in before any request reaches it. Keep
that shape: a second container (`api`, `worker`), scheduled work, file storage or a PostgreSQL
extension is an "ask itm8" item, not something to add.

Read `AGENTS.md` (the build rules) first. Then the reference for the part you change:

| Change | Read |
|---|---|
| API route, validation, errors, logging | [reference/server.md](reference/server.md) |
| Who the user is, roles, the local stand-in user | [reference/easy-auth.md](reference/easy-auth.md) |
| Tables, migrations, audit, transactions | [reference/database.md](reference/database.md) |
| Pages, data fetching, navigation | [reference/spa.md](reference/spa.md) (and the `itm8-design` skill for the look) |
| Headers, cross-site requests, input handling | [reference/security.md](reference/security.md) |
| Model calls, limits, evaluation | [reference/ai-calls.md](reference/ai-calls.md) |
| Tests, the pull request verdict, why there is no preview per pull request | [reference/testing.md](reference/testing.md) |

## Layout

```
src/shared/contracts.ts   zod schemas and DTO types used by server and browser
src/server/config.ts      every setting, validated at startup (names only in errors)
src/server/app.ts         buildApp(): logging, error handler, plugins, routes, static front end
src/server/auth.ts        Easy Auth principal → req.user; requireRole()
src/server/security.ts    security headers, cross-site guard
src/server/routes/*.ts    one file per resource; health.ts has /healthz
src/server/db/            schema.ts, client.ts (Entra token), migrate.ts (separate command)
src/server/lib/           audit.ts, ai.ts (one module for all model calls)
src/web/                  React: main.tsx, router.tsx, Layout.tsx, pages/, design/ (itm8 kit)
drizzle/                  generated SQL migrations, committed
```

## Adding a feature, in order

1. Shape: add or extend the zod schema and DTO in `src/shared/contracts.ts`.
2. Data: change `src/server/db/schema.ts`, run `npm run db:generate`, read the SQL, commit it.
3. Server: a route in `src/server/routes/`, registered in `app.ts`. Validate with `parse(schema, req.body)`,
   check roles with `requireRole`, write audit rows in the same transaction.
4. Front end: a page in `src/web/pages/`, a route in `router.tsx`, a link in `Layout.tsx`. Fetch with
   `api()` and TanStack Query.
5. Tests next to the code (`*.test.ts`), at least one per endpoint and per migration.
6. Update `.env.example` and the README (settings, roles, outside hosts) when they change.
7. `npm run check`, then the build check (`/aifactory-code:check`).

## Never

- A login form, password, user table with credentials, or token in browser storage.
- Secrets in code or files, keys for Azure services, direct OpenAI or Anthropic calls.
- Migrations or `CREATE TABLE` at startup; `CREATE EXTENSION`.
- Timers, queues or files on disk inside the server; requests longer than 30 seconds.
- Bicep, Terraform or deploy pipelines in this repository.
- A deploy, or a change to dev or production Azure resources with `az`, Azure MCP or ARM MCP. Dev
  gets a change through a pull request, the gate and the pipeline; use the sandbox to experiment
  ([environments](../aifactory-code/reference/environments.md)).
