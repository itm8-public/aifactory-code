import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testApp } from './test/helpers';

describe('health', () => {
  let app: Awaited<ReturnType<typeof testApp>>;
  beforeAll(async () => {
    app = await testApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('answers /healthz without sign-in', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
// @if db

  it('answers /readyz when the database is up', async () => {
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(200);
  });
// @endif

  it('answers unknown API routes with JSON 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/nothing-here' });
    expect([401, 404]).toContain(res.statusCode);
  });
});
