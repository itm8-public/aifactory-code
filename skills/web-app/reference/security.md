# Web security in the app

Already in the template (`src/server/security.ts`), keep it:

- **Headers on every response:** `Content-Security-Policy` (only the app's own origin; no inline
  scripts; `frame-ancestors 'none'`), `Strict-Transport-Security`, `X-Content-Type-Options:
  nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`,
  `Cross-Origin-Opener-Policy`. Do not loosen the CSP to load a CDN; self-host the asset.
- **Cross-site guard:** sign-in uses a cookie, so `POST`, `PUT`, `PATCH` and `DELETE` on `/api`
  must come from the app's own origin (checked against `Origin`, the forwarded host, or
  `APP_PUBLIC_ORIGIN`), and requests without `Origin` must send JSON. Change data only with those
  methods, never with `GET`.
- **Body limit:** 1 MB. Uploads need a design decision (file storage is an "ask itm8" item).

Your part (the change gate in `GUARD.md` first: one line per trust boundary, each with a refusal
test that tries to cross it):

- Validate every input on the server with a zod schema (`parse`). Limit string lengths.
- Escape output: React does it for text; never use `dangerouslySetInnerHTML` with user content.
- Parameterized queries only (Drizzle does it).
- Never put user input in a shell command, file path or URL you fetch on the server.
- Rate-limit expensive endpoints per user (object id), with the count in PostgreSQL.
- Dependencies: maintained packages, versions pinned by the lock file, `npm audit` clean of high
  findings before hand-over.
