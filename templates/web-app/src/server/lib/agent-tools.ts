import { desc, ilike } from 'drizzle-orm';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { User } from '../auth';
import type { Tx } from '../db/client';
import { items } from '../db/schema';
import type { ToolSpec } from './ai';
import { writeAudit } from './audit';

// The agent's tools: a fixed list in code. Two kinds:
//  - read: the model may call it, the result goes back to the model.
//  - action: the model can only PROPOSE it. The proposal waits in agent_actions until the user
//    approves it in the app; then `execute` runs, in a transaction with an audit row.
// A prompt instruction is never the control. Replace the examples with the solution's own tools.

interface ReadTool<S extends z.ZodObject> {
  kind: 'read';
  description: string;
  input: S;
  run(ctx: { app: FastifyInstance; user: User }, input: z.infer<S>): Promise<unknown>;
}

interface ActionTool<S extends z.ZodObject> {
  kind: 'action';
  description: string;
  input: S;
  /** One sentence the person reads before approving. */
  summary(input: z.infer<S>): string;
  execute(tx: Tx, user: User, input: z.infer<S>): Promise<{ entity: string; entityId: string }>;
}

const read = <S extends z.ZodObject>(t: Omit<ReadTool<S>, 'kind'>): ReadTool<S> => ({ kind: 'read', ...t });
const action = <S extends z.ZodObject>(t: Omit<ActionTool<S>, 'kind'>): ActionTool<S> => ({ kind: 'action', ...t });

export const AGENT_TOOLS = {
  search_items: read({
    description: 'Find items whose title contains the query, newest first.',
    input: z.object({ query: z.string().trim().min(1).max(200), limit: z.number().int().min(1).max(20).default(10) }),
    run: async ({ app }, { query, limit }) => {
      const rows = await app.db
        .select({ id: items.id, title: items.title })
        .from(items)
        .where(ilike(items.title, `%${query.replace(/[%_\\]/g, '\\$&')}%`))
        .orderBy(desc(items.createdAt))
        .limit(limit);
      return rows;
    },
  }),
  create_item: action({
    description: 'Propose a new item. A person must approve it before it is created.',
    input: z.object({ title: z.string().trim().min(1).max(200) }),
    summary: ({ title }) => `Create the item "${title}"`,
    execute: async (tx, user, { title }) => {
      const [row] = await tx.insert(items).values({ title, createdBy: user.id }).returning({ id: items.id });
      await writeAudit(tx, {
        actorId: user.id,
        action: 'create',
        entity: 'item',
        entityId: row!.id,
        detail: { fields: ['title'], via: 'agent-approved' },
      });
      return { entity: 'item', entityId: row!.id };
    },
  }),
} as const;

export type AgentToolName = keyof typeof AGENT_TOOLS;

export const isAgentTool = (name: string): name is AgentToolName => Object.hasOwn(AGENT_TOOLS, name);

/** The tool list in the shape the model expects. */
export function toolSpecs(): ToolSpec[] {
  return Object.entries(AGENT_TOOLS).map(([name, t]) => ({
    type: 'function',
    function: { name, description: t.description, parameters: z.toJSONSchema(t.input) as Record<string, unknown> },
  }));
}
