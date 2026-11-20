// @if db
import { z } from 'zod';

// @endif
// Request and response shapes shared by the server and the browser. The server validates every
// request body with these schemas; the browser uses the same types.

export interface MeDto {
  id: string;
  name: string;
  roles: string[];
}

export interface ErrorDto {
  error: string;
  requestId: string;
}
// @if db

export const createItemSchema = z.object({
  title: z.string().trim().min(1).max(200),
});
export type CreateItem = z.infer<typeof createItemSchema>;

export interface ItemDto {
  id: string;
  title: string;
  createdBy: string;
  createdAt: string;
}
// @endif
// @if ai

export const askSchema = z.object({
  question: z.string().trim().min(1).max(2000),
});
export type AskInput = z.infer<typeof askSchema>;

export type AskResult =
  | { status: 'answered'; answer: string }
  | { status: 'blocked'; reason: 'content-filter' }
  | { status: 'not-configured' }
  | { status: 'try-later'; reason: 'busy' | 'limit'; retryAfterSeconds: number };
// @endif
// @if agent

/** The conversation so far, kept by the browser: the server stores no chat history. */
export const agentChatSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(4000) }))
    .min(1)
    .max(20),
});
export type AgentChatInput = z.infer<typeof agentChatSchema>;

export interface AgentActionDto {
  id: string;
  tool: string;
  summary: string;
  status: 'pending' | 'approved' | 'rejected' | 'failed';
  createdAt: string;
}

export type AgentChatResult =
  | { status: 'answered'; answer: string; proposals: AgentActionDto[]; toolsUsed: string[] }
  | { status: 'blocked'; reason: 'content-filter' }
  | { status: 'not-configured' }
  | { status: 'try-later'; reason: 'busy' | 'limit'; retryAfterSeconds: number };

export const actionDecisionSchema = z.object({ approve: z.boolean() });
// @endif
