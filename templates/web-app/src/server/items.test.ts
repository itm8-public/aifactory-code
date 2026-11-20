import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { auditLog } from './db/schema';
import { ADMIN, asUser, resetDb, testApp, USER } from './test/helpers';

describe('items', () => {
  let app: Awaited<ReturnType<typeof testApp>>;
  beforeAll(async () => {
    app = await testApp();
  });
  beforeEach(async () => {
    await resetDb(app.db);
  });
  afterAll(async () => {
    await app.close();
  });

  it('creates an item and writes an audit row', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/items',
      headers: asUser(USER),
      payload: { title: 'First item' },
    });
    expect(res.statusCode).toBe(201);
    const audit = await app.db.select().from(auditLog);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorId: USER, action: 'create', entity: 'item' });
  });

  it('rejects an empty title with the field name', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/items', headers: asUser(USER), payload: { title: ' ' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('title');
  });

  it('lets only an admin delete', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/items',
      headers: asUser(USER),
      payload: { title: 'To delete' },
    });
    const { id } = created.json();
    const denied = await app.inject({ method: 'DELETE', url: `/api/items/${id}`, headers: asUser(USER) });
    expect(denied.statusCode).toBe(403);
    const ok = await app.inject({ method: 'DELETE', url: `/api/items/${id}`, headers: asUser(ADMIN, ['App.Admin']) });
    expect(ok.statusCode).toBe(204);
    const list = await app.inject({ method: 'GET', url: '/api/items', headers: asUser(USER) });
    expect(list.json()).toEqual([]);
  });
});
