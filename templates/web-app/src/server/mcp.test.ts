import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// @if db
import { beforeEach } from 'vitest';
import { auditLog, items } from './db/schema';
import { resetDb } from './test/helpers';
// @endif
import { COPILOT_TOKEN_STORE } from './auth';
import { asUser, principal, testApp, USER } from './test/helpers';

const ACCEPT = { accept: 'application/json, text/event-stream' };

/** The JSON-RPC result, from a JSON or a server-sent-events answer. */
function rpc<T>(res: { headers: Record<string, unknown>; body: string }): T {
  const body = String(res.headers['content-type'] ?? '').includes('text/event-stream')
    ? res.body.split(/\r?\n/).find((l) => l.startsWith('data:'))!.slice(5)
    : res.body;
  return (JSON.parse(body) as { result: T }).result;
}

describe('MCP endpoint', () => {
  let app: Awaited<ReturnType<typeof testApp>>;
  const call = (payload: Record<string, unknown>, headers: Record<string, string> = asUser(USER)) =>
    app.inject({ method: 'POST', url: '/mcp', headers: { ...headers, ...ACCEPT }, payload });

  beforeAll(async () => {
    app = await testApp();
  });
// @if db
  beforeEach(async () => {
    await resetDb(app.db);
  });
// @endif
  afterAll(async () => {
    await app.close();
  });

  it('needs a signed-in caller', async () => {
    const res = await call({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, {});
    expect(res.statusCode).toBe(401);
  });

  it('lists the fixed tools as read-only', async () => {
    const res = await call({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(res.statusCode).toBe(200);
    const { tools } = rpc<{ tools: { name: string; annotations?: { readOnlyHint?: boolean } }[] }>(res);
    expect(tools.map((t) => t.name)).toContain('get_service_info');
    expect(tools.every((t) => t.annotations?.readOnlyHint)).toBe(true);
  });

  it('runs a tool for the caller', async () => {
    const res = await call({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_service_info', arguments: {} } });
    const out = rpc<{ structuredContent: { ok: boolean; result: { caller: string } } }>(res);
    expect(out.structuredContent.ok).toBe(true);
    expect(out.structuredContent.result.caller).toBe('Test user');
  });
// @if db

  it('searches data and audits the call without its arguments', async () => {
    await app.db.insert(items).values({ title: 'Quarterly synthetic report', createdBy: USER });
    const res = await call({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'search_items', arguments: { query: 'synthetic' } },
    });
    const out = rpc<{ structuredContent: { result: { title: string }[] } }>(res);
    expect(out.structuredContent.result.map((r) => r.title)).toEqual(['Quarterly synthetic report']);
    const audit = await app.db.select().from(auditLog);
    expect(audit[0]).toMatchObject({ actorId: USER, action: 'mcp-call', entityId: 'search_items' });
    expect(JSON.stringify(audit[0]!.detail)).not.toContain('synthetic');
  });
// @endif

  it('accepts Microsoft 365 Copilot (token store) tokens on /mcp', async () => {
    const headers = { 'x-ms-client-principal': principal(USER, [], 'Test user', COPILOT_TOKEN_STORE) };
    const res = await call({ jsonrpc: '2.0', id: 5, method: 'tools/list' }, headers);
    expect(res.statusCode).toBe(200);
  });

  it('refuses a browser call from another site', async () => {
    const res = await call(
      { jsonrpc: '2.0', id: 4, method: 'tools/list' },
      { ...asUser(USER), origin: 'https://evil.example', host: 'app.example' },
    );
    expect(res.statusCode).toBe(403);
  });
});
