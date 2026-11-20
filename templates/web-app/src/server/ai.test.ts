import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TokenCredential } from '@azure/identity';
import { createAiClient, type AiClient } from './lib/ai';
import { asUser, resetDb, testApp, testConfig, USER } from './test/helpers';

const credential: TokenCredential = {
  getToken: async () => ({ token: 'test-token', expiresOnTimestamp: Date.now() + 60_000 }),
};
const aiConfig = testConfig({
  AZURE_AI_PROJECT_ENDPOINT: 'https://foundry.example/api/projects/test',
  AI_CHAT_DEPLOYMENT: 'chat',
});
const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  (async () => new Response(JSON.stringify(body), { status, headers })) as unknown as typeof fetch;

describe('AI client', () => {
  it('calls the project endpoint with a bearer token', async () => {
    let seen: { url: string; auth: string | null } | undefined;
    const fetchSpy = (async (url: string, init: RequestInit) => {
      seen = { url, auth: new Headers(init.headers).get('authorization') };
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Hello' } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const out = await createAiClient(aiConfig, { fetch: fetchSpy, credential }).ask([{ role: 'user', content: 'Hi' }]);
    expect(out).toEqual({ kind: 'answer', text: 'Hello' });
    expect(seen?.url).toBe('https://foundry.example/api/projects/test/openai/v1/chat/completions');
    expect(seen?.auth).toBe('Bearer test-token');
  });

  it('treats 429 and the content filter as normal answers', async () => {
    const busy = createAiClient(aiConfig, { fetch: reply(429, {}, { 'retry-after': '12' }), credential });
    expect(await busy.ask([])).toEqual({ kind: 'busy', retryAfterSeconds: 12 });
    const filtered = createAiClient(aiConfig, { fetch: reply(400, { error: { code: 'content_filter' } }), credential });
    expect(await filtered.ask([])).toEqual({ kind: 'content-filter' });
  });

  it('answers "not configured" without settings', async () => {
    expect(await createAiClient(testConfig()).ask([])).toEqual({ kind: 'not-configured' });
  });
});

describe('POST /api/ai/ask', () => {
  let app: Awaited<ReturnType<typeof testApp>>;
  const fake: AiClient = {
    ask: async () => ({ kind: 'answer', text: 'An answer' }),
    complete: async () => ({ kind: 'not-configured' }),
  };
  beforeAll(async () => {
    app = await testApp({ config: testConfig({ AI_REQUESTS_PER_USER_PER_HOUR: '2' }), ai: fake });
  });
  beforeEach(async () => {
    await resetDb(app.db);
  });
  afterAll(async () => {
    await app.close();
  });

  it('answers and then applies the per-user limit', async () => {
    const ask = () =>
      app.inject({ method: 'POST', url: '/api/ai/ask', headers: asUser(USER), payload: { question: 'Why?' } });
    expect((await ask()).json()).toEqual({ status: 'answered', answer: 'An answer' });
    await ask();
    expect((await ask()).json()).toMatchObject({ status: 'try-later', reason: 'limit' });
  });
});
