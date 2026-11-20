# Front end: React, Vite, TanStack

- `src/web/main.tsx` loads the itm8 fonts and CSS, TanStack Query and the router.
- Routes are code-based in `src/web/router.tsx` (no generated files): add a `createRoute` and put
  it in `routeTree`; add a link in `Layout.tsx`.
- Data: `useQuery({ queryKey: ['projects'], queryFn: () => api<ProjectDto[]>('/api/projects') })`;
  changes with `useMutation` and `invalidateQueries`. `api()` sends JSON, handles errors and the
  expired-session reload. Types come from `src/shared/contracts.ts`.
- The browser calls only the app's own `/api` (same origin, no CORS, no other hosts). It never
  talks to the database, Foundry or another service directly. Anything in the bundle is public,
  including `VITE_*` values: never put a secret there.
- Rich text: store Markdown or JSON, not HTML (the WAF can block HTML-like bodies, and HTML from
  users is an XSS risk). Render Markdown with a sanitizing renderer.
- Build: `vite build` writes `dist/public`, which the server serves. In development Vite serves
  on :5173 and forwards `/api` and `/healthz` to the server on :8080.
- Look and components: the `itm8-design` skill. Use the kit in `src/web/design/`.
- Accessibility: labels on every field, keyboard reachable controls, status in words, focus
  visible (the kit does this when you use its components).
