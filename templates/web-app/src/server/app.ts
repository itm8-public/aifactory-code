// @if spa
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
// @endif
import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyError } from 'fastify';
import type { Config } from './config';
import { registerAuth } from './auth';
import { HttpError } from './errors';
import { registerSecurity } from './security';
import { healthRoutes } from './routes/health';
import { meRoutes } from './routes/me';
// @if db
import { createDb, type Db } from './db/client';
// @endif
// @if spa
// @if db
import { itemRoutes } from './routes/items';
// @endif
// @endif
// @if ai
import { createAiClient, type AiClient } from './lib/ai';
import { aiRoutes } from './routes/ai';
// @endif
// @if agent
import { agentRoutes } from './routes/agent';
// @endif
// @if mcp
import { mcpRoutes } from './routes/mcp';
// @endif

export interface BuildAppOptions {
  config: Config;
  logger?: boolean;
// @if spa
  /** Folder with the built front end. Default: dist/public next to the server bundle; null: none. */
  publicDir?: string | null;
// @endif
// @if db
  /** Tests pass their own database; otherwise one is created from the PG* settings. */
  db?: Db;
// @endif
// @if ai
  /** Tests pass a fake; otherwise the Foundry client from the settings. */
  ai?: AiClient;
// @endif
}

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
// @if db
    db: Db;
// @endif
// @if ai
    ai: AiClient;
// @endif
  }
}

const REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

export async function buildApp(opts: BuildAppOptions) {
  const { config } = opts;
  const app = Fastify({
    logger:
      opts.logger === false
        ? false
        : {
            level: config.LOG_LEVEL,
            // Structured JSON to stdout. Never log secrets, tokens, cookies or request bodies.
            redact: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.headers["x-ms-client-principal"]',
              'req.headers["x-ms-token-aad-access-token"]',
              'req.headers["x-ms-token-aad-id-token"]',
              'req.headers["x-ms-token-aad-refresh-token"]',
            ],
          },
    // Honour a well-formed request id from the gateway, otherwise mint one.
    genReqId: (req) => {
      const given = req.headers['x-request-id'];
      const id = Array.isArray(given) ? given[0] : given;
      return id && REQUEST_ID.test(id) ? id : randomUUID();
    },
    bodyLimit: 1024 * 1024,
  });

  app.decorate('config', config);
// @if db
  if (opts.db) {
    app.decorate('db', opts.db);
  } else {
    const { db, sql } = createDb(config);
    app.decorate('db', db);
    app.addHook('onClose', async () => sql.end());
  }
// @endif
// @if ai
  app.decorate('ai', opts.ai ?? createAiClient(config));
// @endif

  // Users see a short message and the request id; details go to the log only.
  app.setErrorHandler((err: FastifyError | HttpError, req, reply) => {
    const status = err instanceof HttpError ? err.statusCode : (err.statusCode ?? 500);
    if (status >= 500) req.log.error({ err }, 'request failed');
    const message =
      err instanceof HttpError || (status < 500 && err.validation)
        ? err.message
        : status < 500
          ? 'The request was not accepted.'
          : 'Something went wrong. Try again, and give support the request id if it keeps failing.';
    return reply.code(status).send({ error: message, requestId: req.id });
  });

  registerSecurity(app, config);
  registerAuth(app, config);

  await app.register(healthRoutes);
  await app.register(meRoutes);
// @if spa
// @if db
  await app.register(itemRoutes);
// @endif
// @endif
// @if ai
  await app.register(aiRoutes);
// @endif
// @if agent
  await app.register(agentRoutes);
// @endif
// @if mcp
  await app.register(mcpRoutes);
// @endif
// @if spa

  // The built front end, served from the same origin as the API (no CORS).
  const publicDir =
    opts.publicDir === undefined
      ? path.join(path.dirname(fileURLToPath(import.meta.url)), 'public')
      : opts.publicDir;
  if (publicDir && existsSync(publicDir)) {
    await app.register(fastifyStatic, { root: publicDir, wildcard: false });
  }
  app.setNotFoundHandler((req, reply) => {
    const wantsPage = req.method === 'GET' && !req.url.startsWith('/api/') && Boolean(publicDir && existsSync(publicDir));
    if (wantsPage) return reply.sendFile('index.html');
    return reply.code(404).send({ error: 'Not found.', requestId: req.id });
  });
// @endif
// @if !spa
  app.setNotFoundHandler((req, reply) => reply.code(404).send({ error: 'Not found.', requestId: req.id }));
// @endif

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
