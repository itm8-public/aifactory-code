import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { COPILOT_TOKEN_STORE, parsePrincipal } from './auth';
import { asUser, principal, testApp, testConfig, USER } from './test/helpers';

describe('Easy Auth principal', () => {
  it('reads the object id, name and roles', () => {
    expect(parsePrincipal(principal(USER, ['App.Admin'], 'Ada'))).toEqual({
      id: USER,
      name: 'Ada',
      roles: ['App.Admin'],
    });
  });

  it('rejects a missing or malformed header', () => {
    expect(parsePrincipal(undefined)).toBeNull();
    expect(parsePrincipal('not base64 json')).toBeNull();
    expect(parsePrincipal(Buffer.from('{"claims":[]}').toString('base64'))).toBeNull();
  });
});

describe('API sign-in', () => {
  let app: Awaited<ReturnType<typeof testApp>>;
  beforeAll(async () => {
    app = await testApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('answers 401 without a signed-in user', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toHaveProperty('requestId');
  });

  it('returns the signed-in user', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me', headers: asUser(USER, ['App.Reader']) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: USER, roles: ['App.Reader'] });
  });

  it('refuses Copilot token store tokens outside the MCP endpoint', async () => {
    const headers = { 'x-ms-client-principal': principal(USER, [], 'Test user', COPILOT_TOKEN_STORE) };
    const res = await app.inject({ method: 'GET', url: '/api/me', headers });
    expect(res.statusCode).toBe(403);
  });

  it('uses the stand-in user only with the local bypass', async () => {
    const local = await testApp({ config: testConfig({ DEV_AUTH_BYPASS: 'true' }) });
    const res = await local.inject({ method: 'GET', url: '/api/me' });
    expect(res.statusCode).toBe(200);
    await local.close();
  });
});

describe('security headers and cross-site guard', () => {
  let app: Awaited<ReturnType<typeof testApp>>;
  beforeAll(async () => {
    app = await testApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('sends a CSP that forbids framing and inline script', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
    expect(res.headers['strict-transport-security']).toBeDefined();
  });

  it('refuses a change from another origin', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me',
      headers: { ...asUser(USER), origin: 'https://evil.example', host: 'app.example' },
      payload: {},
    });
    expect(res.statusCode).toBe(403);
  });
});
