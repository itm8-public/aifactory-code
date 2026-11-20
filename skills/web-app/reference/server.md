# Server: routes, settings, errors, logging

## A route

```ts
// src/server/routes/projects.ts
import type { FastifyInstance } from 'fastify';
import { createProjectSchema, type ProjectDto } from '../../shared/contracts';
import { requireRole, userOf } from '../auth';
import { parse } from '../errors';

export async function projectRoutes(app: FastifyInstance) {
  app.get('/api/projects', async (req): Promise<ProjectDto[]> => { userOf(req); /* query */ });
  app.post('/api/projects', async (req, reply) => {
    const user = requireRole(req, 'App.Editor');
    const input = parse(createProjectSchema, req.body);   // 400 names the bad fields
    // insert + writeAudit in one transaction (database.md)
    reply.code(201);
  });
}
```

Register it in `app.ts` with `await app.register(projectRoutes)`. Every `/api/*` route already
requires a signed-in user (`auth.ts`); `userOf(req)` returns it.

## Settings

- Add each new setting to the zod schema in `src/server/config.ts` and to `.env.example` (name and
  a comment, never a secret value). Startup fails and lists every invalid name.
- Do not define the names the platform sets: `APP_ENVIRONMENT`, `AZURE_CLIENT_ID`, `PG*`,
  `DB_RUNTIME_ROLES`, `AZURE_OPENAI_ENDPOINT`, `AZURE_AI_PROJECT_ENDPOINT`, `<NAME>_URL`.
- A secret (rare: Azure access uses the managed identity) is a setting whose value comes from
  Key Vault in Azure. Mark it in `.env.example` with `# from Key Vault` and list it in the README.

## Errors

- Throw `HttpError(status, message)` (or `notFound()`, `forbidden()`) for what the user should
  see. Any other error becomes a 500 with a generic message and the request id; the details go to
  the log.
- Users see a short message and the request id, never a stack trace.

## Logging

- `req.log.info({ itemId }, 'item archived')`: structured JSON to stdout, one event per line,
  with the request id. Log ids and outcomes, never request bodies, personal data, prompts,
  tokens or cookies. Headers with credentials are redacted in `app.ts`.

## Long work

The gateway cancels a request after 30 seconds. Start the work, store its state in PostgreSQL,
answer at once with an id, and let the browser poll `GET /api/jobs/:id`. A background worker is an
"ask itm8" item; until then, keep work short enough to finish inside the request.
