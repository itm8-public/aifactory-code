import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
// @if db
import { desc, ilike } from 'drizzle-orm';
import { items } from '../db/schema';
// @endif
import type { User } from '../auth';

// The tools this MCP server offers: a fixed list in code. Each one is read-only, checks what the
// signed-in caller may see, and returns plain data. A tool that changes data needs a human
// approval step first; ask itm8 before you add one.

export interface McpToolContext {
  app: FastifyInstance;
  user: User;
}

interface ToolDef<S extends z.ZodObject> {
  name: string;
  title: string;
  description: string;
  input: S;
  run(ctx: McpToolContext, input: z.infer<S>): Promise<unknown>;
}

const tool = <S extends z.ZodObject>(def: ToolDef<S>) => def;

export const MCP_TOOLS = [
  tool({
    name: 'get_service_info',
    title: 'Get service information',
    description: 'Name of this service, the signed-in caller and the server time. Use it to check the connection.',
    input: z.object({}),
    run: async ({ user }) => ({ service: '__TITLE__', caller: user.name, time: new Date().toISOString() }),
  }),
// @if db
  tool({
    name: 'search_items',
    title: 'Search items',
    description: 'Find items whose title contains the query. Returns at most `limit` items, newest first.',
    input: z.object({
      query: z.string().trim().min(1).max(200).describe('Words to look for in the title.'),
      limit: z.number().int().min(1).max(50).default(10).describe('Most items to return.'),
    }),
    run: async ({ app }, { query, limit }) => {
      const rows = await app.db
        .select({ id: items.id, title: items.title, createdAt: items.createdAt })
        .from(items)
        .where(ilike(items.title, `%${query.replace(/[%_\\]/g, '\\$&')}%`))
        .orderBy(desc(items.createdAt))
        .limit(limit);
      return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
    },
  }),
// @endif
];
