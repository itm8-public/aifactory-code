import type { TokenCredential } from '@azure/identity';
import type { Config } from '../config';

// Every model call goes through this module, so the endpoint, identity, limits and logging live
// in one place. Azure AI Foundry only, with the app's managed identity: no API keys, and never
// OpenAI.com, Anthropic or another provider directly. Prompts and answers are never logged.

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

/** A function the model may call, described with a JSON schema. */
export interface ToolSpec {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

/** A token limit, a content filter and missing settings are normal outcomes, not failures. */
type Common = { kind: 'content-filter' } | { kind: 'busy'; retryAfterSeconds: number } | { kind: 'not-configured' };

export type AskOutcome = { kind: 'answer'; text: string } | Common;
export type CompleteOutcome = { kind: 'message'; content: string | null; toolCalls: ToolCall[] } | Common;

export interface AiClient {
  /** One question, one answer. */
  ask(messages: ChatMessage[]): Promise<AskOutcome>;
  /** One model turn, which may ask for tool calls. */
  complete(messages: ChatMessage[], tools?: ToolSpec[]): Promise<CompleteOutcome>;
}

/** Calls longer than this would hit the gateway's 30-second limit. */
export const AI_TIMEOUT_MS = 25_000;

interface Target {
  url: string;
  scope: string;
}

/**
 * AZURE_OPENAI_ENDPOINT (customer landing zones: the Foundry account or the AI gateway) wins;
 * otherwise the Foundry project endpoint (itm8's shared platform, audience https://ai.azure.com).
 */
export function targetOf(config: Config): Target | null {
  const trim = (u: string) => u.replace(/\/+$/, '');
  if (config.AZURE_OPENAI_ENDPOINT) {
    return {
      url: `${trim(config.AZURE_OPENAI_ENDPOINT)}/openai/v1/chat/completions`,
      scope: config.AI_TOKEN_SCOPE ?? 'https://cognitiveservices.azure.com/.default',
    };
  }
  if (config.AZURE_AI_PROJECT_ENDPOINT) {
    return {
      url: `${trim(config.AZURE_AI_PROJECT_ENDPOINT)}/openai/v1/chat/completions`,
      scope: config.AI_TOKEN_SCOPE ?? 'https://ai.azure.com/.default',
    };
  }
  return null;
}

export function createAiClient(
  config: Config,
  deps: { fetch?: typeof fetch; credential?: TokenCredential } = {},
): AiClient {
  const target = targetOf(config);
  const deployment = config.AI_CHAT_DEPLOYMENT;
  if (!target || !deployment) {
    return { ask: async () => ({ kind: 'not-configured' }), complete: async () => ({ kind: 'not-configured' }) };
  }

  const doFetch = deps.fetch ?? fetch;
  let credential = deps.credential;

  async function token(scope: string): Promise<string> {
    if (!credential) {
      const { DefaultAzureCredential } = await import('@azure/identity');
      credential = new DefaultAzureCredential({ managedIdentityClientId: config.AZURE_CLIENT_ID });
    }
    const t = await credential.getToken(scope);
    if (!t) throw new Error('Could not get an Entra token for Azure AI Foundry');
    return t.token;
  }

  async function complete(messages: ChatMessage[], tools?: ToolSpec[]): Promise<CompleteOutcome> {
    const res = await doFetch(target!.url, {
      method: 'POST',
      headers: { authorization: `Bearer ${await token(target!.scope)}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: deployment, messages, ...(tools?.length ? { tools } : {}) }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
    if (res.status === 429) {
      const retry = Number(res.headers.get('retry-after'));
      return { kind: 'busy', retryAfterSeconds: Number.isFinite(retry) && retry > 0 ? retry : 30 };
    }
    const body = (await res.json().catch(() => null)) as {
      error?: { code?: string };
      choices?: { finish_reason?: string; message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
    } | null;
    if (body?.error?.code === 'content_filter') return { kind: 'content-filter' };
    if (!res.ok) throw new Error(`AI request failed with status ${res.status}`);
    const choice = body?.choices?.[0];
    if (choice?.finish_reason === 'content_filter') return { kind: 'content-filter' };
    return { kind: 'message', content: choice?.message?.content ?? null, toolCalls: choice?.message?.tool_calls ?? [] };
  }

  return {
    complete,
    async ask(messages) {
      const out = await complete(messages);
      return out.kind === 'message' ? { kind: 'answer', text: out.content ?? '' } : out;
    },
  };
}
