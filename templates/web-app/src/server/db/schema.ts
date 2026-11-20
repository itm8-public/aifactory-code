// @if ai
import { bigint, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
// @endif
// @if !ai
import { bigint, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
// @endif

// Column names are snake_case in the database (drizzle `casing: 'snake_case'`).
// Ids use the built-in gen_random_uuid(): no PostgreSQL extensions.
// Change this file, then run `npm run db:generate` and commit the new SQL in drizzle/.

export const items = pgTable('items', {
  id: uuid().primaryKey().defaultRandom(),
  title: text().notNull(),
  /** Entra object id of the user who created it. */
  createdBy: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/**
 * Who changed what. The app's database role may only read and insert here (see migrate.ts), so
 * the trail is append-only. Record ids and field names, not personal data.
 */
export const auditLog = pgTable('audit_log', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  actorId: text().notNull(),
  action: text().notNull(),
  entity: text().notNull(),
  entityId: text().notNull(),
  detail: jsonb().$type<Record<string, unknown>>(),
});
// @if ai

/** One row per AI request, for the per-user rate limit (any replica may serve any request). */
export const aiUsage = pgTable(
  'ai_usage',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: text().notNull(),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('ai_usage_user_at_idx').on(t.userId, t.at)],
);
// @endif
// @if agent

/**
 * Actions the agent proposed. The model can only propose; a person approves or rejects in the
 * app, and only then does the server run the action (see lib/agent-tools.ts).
 */
export const agentActions = pgTable(
  'agent_actions',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Entra object id of the user the agent worked for; only they decide. */
    userId: text().notNull(),
    tool: text().notNull(),
    arguments: jsonb().$type<Record<string, unknown>>().notNull(),
    summary: text().notNull(),
    status: text({ enum: ['pending', 'approved', 'rejected', 'failed'] }).notNull().default('pending'),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index('agent_actions_user_status_idx').on(t.userId, t.status)],
);
// @endif
