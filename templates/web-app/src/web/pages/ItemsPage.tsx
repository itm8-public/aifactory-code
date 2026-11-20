import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ItemDto } from '../../shared/contracts';
import { api, type ApiError } from '../api';
import { Badge, Button, Card, Input } from '../design/components';
import { useMe } from '../Layout';

export function ItemsPage() {
  const queryClient = useQueryClient();
  const me = useMe();
  const isAdmin = me.data?.roles.includes('App.Admin') ?? false;
  const items = useQuery({ queryKey: ['items'], queryFn: () => api<ItemDto[]>('/api/items') });
  const [title, setTitle] = useState('');

  const create = useMutation({
    mutationFn: (t: string) => api<ItemDto>('/api/items', { method: 'POST', body: { title: t } }),
    onSuccess: () => {
      setTitle('');
      return queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api<void>(`/api/items/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (title.trim()) create.mutate(title);
  };
  const error = (create.error ?? remove.error) as ApiError | null;

  return (
    <>
      <h2>Items</h2>
      <Card variant="outlined">
        <form className="app-form" onSubmit={submit}>
          <Input
            label="Title"
            name="title"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            error={create.error ? (create.error as ApiError).message : undefined}
            hint="Use synthetic data only until itm8 has confirmed the zone."
          />
          <Button type="submit" disabled={create.isPending}>
            Add item
          </Button>
        </form>
      </Card>

      {error && !create.error ? (
        <p role="alert">
          Error: {error.message} {error.requestId ? <small>(request id {error.requestId})</small> : null}
        </p>
      ) : null}

      {items.isPending ? <p className="app-muted">Loading items…</p> : null}
      {items.data?.length === 0 ? <p className="app-muted">No items yet. Add the first one.</p> : null}
      <ul className="app-list">
        {items.data?.map((item) => (
          <li key={item.id}>
            <Card variant="outlined" className="app-row">
              <span>{item.title}</span>
              <Badge variant="neutral">{new Date(item.createdAt).toLocaleDateString()}</Badge>
              {isAdmin ? (
                <Button variant="ghost" size="sm" onClick={() => remove.mutate(item.id)}>
                  Delete item
                </Button>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
