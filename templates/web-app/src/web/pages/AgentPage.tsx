import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AgentActionDto, AgentChatResult } from '../../shared/contracts';
import { api, type ApiError } from '../api';
import { Badge, Button, Card } from '../design/components';

type Turn = { role: 'user' | 'assistant'; content: string };

function replyText(result: AgentChatResult): string {
  switch (result.status) {
    case 'answered':
      return result.answer;
    case 'blocked':
      return 'The content filter blocked this message or its answer. Rephrase it and try again.';
    case 'try-later':
      return result.reason === 'limit'
        ? `You have reached your hourly limit. Try again in about ${Math.ceil(result.retryAfterSeconds / 60)} minutes.`
        : `The AI service is busy. Try again in ${result.retryAfterSeconds} seconds.`;
    case 'not-configured':
      return 'AI is not configured here. Set the Foundry endpoint and the deployment name in the settings.';
  }
}

export function AgentPage() {
  const queryClient = useQueryClient();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const actions = useQuery({ queryKey: ['agent-actions'], queryFn: () => api<AgentActionDto[]>('/api/agent/actions') });

  const send = useMutation({
    // The browser keeps the conversation; the server stores no chat history. Last 20 turns only.
    mutationFn: (history: Turn[]) => api<AgentChatResult>('/api/agent/chat', { method: 'POST', body: { messages: history.slice(-20) } }),
    onSuccess: (result) => {
      setTurns((t) => [...t, { role: 'assistant', content: replyText(result) }]);
      return queryClient.invalidateQueries({ queryKey: ['agent-actions'] });
    },
  });
  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      api<AgentActionDto>(`/api/agent/actions/${id}/decision`, { method: 'POST', body: { approve } }),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    const history = [...turns, { role: 'user' as const, content }];
    setTurns(history);
    setText('');
    send.mutate(history);
  };

  return (
    <>
      <h2>Assistant</h2>
      <p className="app-notice">
        You are talking to an AI. It can look things up and propose changes, but nothing changes until you approve it
        below. Answers can be wrong. Do not enter personal data.
      </p>

      {actions.data?.length ? (
        <Card variant="muted">
          <h3>Waiting for your approval</h3>
          <ul className="app-list">
            {actions.data.map((a) => (
              <li key={a.id}>
                <Card variant="outlined" className="app-row">
                  <span>{a.summary}</span>
                  <Badge variant="outline">Proposed by AI</Badge>
                  <Button size="sm" onClick={() => decide.mutate({ id: a.id, approve: true })} disabled={decide.isPending}>
                    Approve
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => decide.mutate({ id: a.id, approve: false })} disabled={decide.isPending}>
                    Reject
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <ul className="app-list" aria-live="polite">
        {turns.map((t, i) => (
          <li key={i}>
            <Card variant={t.role === 'user' ? 'outlined' : 'muted'} className="app-answer">
              <p className="itm8-overline">{t.role === 'user' ? 'You' : 'Assistant (AI)'}</p>
              <p>{t.content}</p>
            </Card>
          </li>
        ))}
      </ul>

      <Card variant="outlined">
        <form className="app-form" onSubmit={submit}>
          <label className="itm8-field__label" htmlFor="message">
            Message
          </label>
          <textarea
            id="message"
            className="itm8-input"
            rows={3}
            maxLength={4000}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button type="submit" disabled={send.isPending}>
            {send.isPending ? 'Thinking…' : 'Send'}
          </Button>
        </form>
      </Card>
      {send.error ? <p role="alert">Error: {(send.error as ApiError).message}</p> : null}
      {decide.error ? <p role="alert">Error: {(decide.error as ApiError).message}</p> : null}
    </>
  );
}
