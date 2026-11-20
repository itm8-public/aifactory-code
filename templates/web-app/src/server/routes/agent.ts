import type { FastifyInstance } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  actionDecisionSchema,
  agentChatSchema,
  type AgentActionDto,
  type AgentChatResult,
} from '../../shared/contracts';
import { userOf } from '../auth';
import { agentActions } from '../db/schema';
import { HttpError, notFound, parse } from '../errors';
import { actionToDto, runAgent } from '../lib/agent';
import { AGENT_TOOLS, isAgentTool } from '../lib/agent-tools';
import { takeAiQuota } from '../lib/ai-quota';
import { writeAudit } from '../lib/audit';

const idParams = z.object({ id: z.uuid() });

export async function agentRoutes(app: FastifyInstance) {
  app.post('/api/agent/chat', async (req): Promise<AgentChatResult> => {
    const user = userOf(req);
    const { messages } = parse(agentChatSchema, req.body);
    if (!(await takeAiQuota(app, user.id))) {
      return { status: 'try-later', reason: 'limit', retryAfterSeconds: 15 * 60 };
    }
    return runAgent(app, user, messages);
  });

  app.get('/api/agent/actions', async (req): Promise<AgentActionDto[]> => {
    const user = userOf(req);
    const rows = await app.db
      .select()
      .from(agentActions)
      .where(and(eq(agentActions.userId, user.id), eq(agentActions.status, 'pending')))
      .orderBy(desc(agentActions.createdAt))
      .limit(50);
    return rows.map(actionToDto);
  });

  // The human in the loop: only the user the agent worked for decides, and only then does the
  // server run the action, in one transaction with its audit row.
  app.post('/api/agent/actions/:id/decision', async (req): Promise<AgentActionDto> => {
    const user = userOf(req);
    const { id } = parse(idParams, req.params);
    const { approve } = parse(actionDecisionSchema, req.body);
    const row = await app.db.transaction(async (tx) => {
      const [pending] = await tx
        .select()
        .from(agentActions)
        .where(and(eq(agentActions.id, id), eq(agentActions.userId, user.id)))
        .for('update');
      if (!pending) throw notFound('The proposed action');
      if (pending.status !== 'pending') throw new HttpError(409, 'This action has already been decided.');
      if (approve && isAgentTool(pending.tool)) {
        const tool = AGENT_TOOLS[pending.tool];
        if (tool.kind !== 'action') throw new HttpError(409, 'This action can no longer run.');
        await tool.execute(tx, user, tool.input.parse(pending.arguments) as never);
      }
      const status = approve && isAgentTool(pending.tool) ? 'approved' : approve ? 'failed' : 'rejected';
      const [decided] = await tx
        .update(agentActions)
        .set({ status, decidedAt: new Date() })
        .where(eq(agentActions.id, id))
        .returning();
      await writeAudit(tx, {
        actorId: user.id,
        action: `agent-action-${status}`,
        entity: 'agent-action',
        entityId: id,
        detail: { tool: pending.tool },
      });
      return decided!;
    });
    return actionToDto(row);
  });
}
