import type { FastifyInstance } from 'fastify';
import { askSchema, type AskResult } from '../../shared/contracts';
import { userOf } from '../auth';
import { parse } from '../errors';
import { takeAiQuota } from '../lib/ai-quota';

// Example AI endpoint: one question, one answer. Users are told they talk to an AI in the UI.

const SYSTEM_PROMPT =
  'You are a helpful assistant inside an itm8 business application. Answer briefly and say when you are not sure.';

export async function aiRoutes(app: FastifyInstance) {
  app.post('/api/ai/ask', async (req): Promise<AskResult> => {
    const user = userOf(req);
    const { question } = parse(askSchema, req.body);
    if (!(await takeAiQuota(app, user.id))) {
      return { status: 'try-later', reason: 'limit', retryAfterSeconds: 15 * 60 };
    }
    const outcome = await app.ai.ask([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: question },
    ]);
    switch (outcome.kind) {
      case 'answer':
        return { status: 'answered', answer: outcome.text };
      case 'content-filter':
        return { status: 'blocked', reason: 'content-filter' };
      case 'busy':
        return { status: 'try-later', reason: 'busy', retryAfterSeconds: outcome.retryAfterSeconds };
      case 'not-configured':
        return { status: 'not-configured' };
    }
  });
}
