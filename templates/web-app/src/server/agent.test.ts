import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AiClient, CompleteOutcome } from './lib/ai';
import { agentActions, auditLog, items } from './db/schema';
import { ADMIN, asUser, resetDb, testApp, USER } from './test/helpers';

/** A fake model that plays back a fixed script of turns. */
function scripted(turns: CompleteOutcome[]): AiClient {
  let i = 0;
  return {
    ask: async () => ({ kind: 'not-configured' }),
    complete: async () => turns[Math.min(i++, turns.length - 1)]!,
  };
}

const call = (id: string, name: string, args: unknown) => ({
  id,
  type: 'function' as const,
  function: { name, arguments: JSON.stringify(args) },
});

describe('agent with tools and human approval', () => {
  let app: Awaited<ReturnType<typeof testApp>>;
  const ai = { current: scripted([]) };
  const proxy: AiClient = { ask: (m) => ai.current.ask(m), complete: (m, t) => ai.current.complete(m, t) };

  beforeAll(async () => {
    app = await testApp({ ai: proxy });
  });
  beforeEach(async () => {
    await resetDb(app.db);
  });
  afterAll(async () => {
    await app.close();
  });

  const chat = (content: string, user = USER) =>
    app.inject({ method: 'POST', url: '/api/agent/chat', headers: asUser(user), payload: { messages: [{ role: 'user', content }] } });

  it('reads with a tool, proposes an action, and changes nothing until approved', async () => {
    ai.current = scripted([
      { kind: 'message', content: null, toolCalls: [call('c1', 'search_items', { query: 'report' })] },
      { kind: 'message', content: null, toolCalls: [call('c2', 'create_item', { title: 'Weekly report' })] },
      { kind: 'message', content: 'I proposed the item. Approve it on the page.', toolCalls: [] },
    ]);
    const res = await chat('Create a weekly report item');
    const body = res.json();
    expect(body.status).toBe('answered');
    expect(body.toolsUsed).toEqual(['search_items', 'create_item']);
    expect(body.proposals).toHaveLength(1);
    expect(await app.db.select().from(items)).toHaveLength(0);

    const decide = await app.inject({
      method: 'POST',
      url: `/api/agent/actions/${body.proposals[0].id}/decision`,
      headers: asUser(USER),
      payload: { approve: true },
    });
    expect(decide.json().status).toBe('approved');
    expect((await app.db.select().from(items)).map((i) => i.title)).toEqual(['Weekly report']);
    const audit = await app.db.select().from(auditLog);
    expect(audit.map((a) => a.action).sort()).toEqual(['agent-action-approved', 'create']);
  });

  it('lets only the same user decide, once', async () => {
    ai.current = scripted([
      { kind: 'message', content: null, toolCalls: [call('c1', 'create_item', { title: 'Mine' })] },
      { kind: 'message', content: 'Proposed.', toolCalls: [] },
    ]);
    const { proposals } = (await chat('Add mine')).json();
    const url = `/api/agent/actions/${proposals[0].id}/decision`;
    const other = await app.inject({ method: 'POST', url, headers: asUser(ADMIN, ['App.Admin']), payload: { approve: true } });
    expect(other.statusCode).toBe(404);
    const reject = await app.inject({ method: 'POST', url, headers: asUser(USER), payload: { approve: false } });
    expect(reject.json().status).toBe('rejected');
    const again = await app.inject({ method: 'POST', url, headers: asUser(USER), payload: { approve: true } });
    expect(again.statusCode).toBe(409);
    expect(await app.db.select().from(items)).toHaveLength(0);
  });

  it('ignores unknown tools and bad arguments', async () => {
    ai.current = scripted([
      { kind: 'message', content: null, toolCalls: [call('c1', 'delete_everything', {}), call('c2', 'create_item', { title: '' })] },
      { kind: 'message', content: 'Done.', toolCalls: [] },
    ]);
    const body = (await chat('Do something')).json();
    expect(body.proposals).toEqual([]);
    expect(await app.db.select().from(agentActions)).toHaveLength(0);
  });

  it('stops after a bounded number of steps', async () => {
    ai.current = scripted([{ kind: 'message', content: null, toolCalls: [call('c', 'search_items', { query: 'x' })] }]);
    const body = (await chat('Loop forever')).json();
    expect(body.status).toBe('answered');
    expect(body.toolsUsed.length).toBeLessThanOrEqual(4);
  });
});
