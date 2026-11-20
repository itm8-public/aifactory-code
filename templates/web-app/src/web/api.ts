import type { ErrorDto } from '../shared/contracts';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly requestId?: string,
  ) {
    super(message);
  }
}

/**
 * Calls the app's own API (same origin, the Easy Auth cookie goes along). The header makes
 * Easy Auth answer 401 instead of redirecting when the sign-in has expired; then the page reloads,
 * which signs the user in again.
 */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? 'GET',
    credentials: 'same-origin',
    headers: {
      'x-requested-with': 'XMLHttpRequest',
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (res.status === 401 && import.meta.env.PROD) {
    window.location.reload();
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ErrorDto | null;
    throw new ApiError(res.status, body?.error ?? 'Something went wrong.', body?.requestId);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}
