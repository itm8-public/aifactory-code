import type { FastifyInstance } from 'fastify';
// @if db
import { sql } from 'drizzle-orm';
// @endif

export async function healthRoutes(app: FastifyInstance) {
  // Liveness and readiness probe: fast, no sign-in, no database.
  app.get('/healthz', async () => ({ status: 'ok' }));
// @if db

  // For people and dashboards: also checks the database.
  app.get('/readyz', async (req, reply) => {
    try {
      await app.db.execute(sql`select 1`);
      return { status: 'ok' };
    } catch {
      req.log.warn('readiness check: database unavailable');
      return reply.code(503).send({ status: 'unavailable' });
    }
  });
// @endif
}
