import type { FastifyInstance } from 'fastify';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createItemSchema, type ItemDto } from '../../shared/contracts';
import { requireRole, userOf } from '../auth';
import { items } from '../db/schema';
import { notFound, parse } from '../errors';
import { writeAudit } from '../lib/audit';

// An example resource: replace it with the solution's own. Every change writes an audit row in
// the same transaction, and permissions are checked here on the server.

const ADMIN_ROLE = 'App.Admin';
const idParams = z.object({ id: z.uuid() });

const toDto = (row: typeof items.$inferSelect): ItemDto => ({
  id: row.id,
  title: row.title,
  createdBy: row.createdBy,
  createdAt: row.createdAt.toISOString(),
});

export async function itemRoutes(app: FastifyInstance) {
  app.get('/api/items', async (): Promise<ItemDto[]> => {
    const rows = await app.db.select().from(items).orderBy(desc(items.createdAt)).limit(100);
    return rows.map(toDto);
  });

  app.post('/api/items', async (req, reply): Promise<ItemDto> => {
    const user = userOf(req);
    const input = parse(createItemSchema, req.body);
    const row = await app.db.transaction(async (tx) => {
      const [created] = await tx.insert(items).values({ title: input.title, createdBy: user.id }).returning();
      await writeAudit(tx, {
        actorId: user.id,
        action: 'create',
        entity: 'item',
        entityId: created!.id,
        detail: { fields: ['title'] },
      });
      return created!;
    });
    reply.code(201);
    return toDto(row);
  });

  app.delete('/api/items/:id', async (req, reply) => {
    const user = requireRole(req, ADMIN_ROLE);
    const { id } = parse(idParams, req.params);
    await app.db.transaction(async (tx) => {
      const [deleted] = await tx.delete(items).where(eq(items.id, id)).returning({ id: items.id });
      if (!deleted) throw notFound('The item');
      await writeAudit(tx, { actorId: user.id, action: 'delete', entity: 'item', entityId: id });
    });
    return reply.code(204).send();
  });
}
