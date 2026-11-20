# Build check rule ids

`scripts/build-check.mjs` reports one line per rule. The ids are local (`AF-xx`) until the
upstream build rules get their own ids (`BR-xx`); then this table maps them and the output shows
both for one minor release.

| Id | Severity | What is checked | Build rules section |
|---|---|---|---|
| AF-01 | FAIL | `AGENTS.md` holds the pinned rules with "This project" filled in, and `.aifactory/build-profile.json` is valid | This project |
| AF-02 | FAIL | A `Dockerfile` for the app | Shape of the app |
| AF-03 | FAIL | The app listens on port 8080 | Shape of the app |
| AF-04 | FAIL | A `/healthz` route | Shape of the app |
| AF-05 | FAIL | The image runs as a non-root user | Shape of the app |
| AF-06 | WARN | Base images pinned by digest | Shape of the app |
| AF-07 | FAIL | No timers or schedulers inside the server (ask itm8 about scheduled work) | Shape of the app |
| AF-08 | WARN | No writes to the container's disk | Shape of the app |
| AF-09 | FAIL | No infrastructure or deployment code (Bicep, Terraform, azd, deploy steps in workflows) | Build, test, dependencies |
| AF-10 | FAIL | `.env.example` exists, `.env` is ignored and no `.env` file is in the repository | Configuration and secrets |
| AF-11 | FAIL | No secret-shaped values (private keys, tokens, connection strings with passwords, account keys) | Configuration and secrets |
| AF-12 | FAIL | No key-based Azure access (`AzureKeyCredential`, `api-key` headers, `*_API_KEY` settings for Azure services) | Azure access: no keys |
| AF-13 | FAIL | No own login system (passport-local, bcrypt, argon2, next-auth, Auth.js, Clerk, Auth0, Firebase Auth) | Sign-in and permissions |
| AF-14 | FAIL | No Supabase, Firebase or Base44 backend references | Sign-in and permissions; Data |
| AF-15 | FAIL | `DEV_AUTH_BYPASS` is refused when `APP_ENVIRONMENT` is set | Sign-in and permissions |
| AF-16 | FAIL | PostgreSQL only: no SQLite, MongoDB or MySQL drivers | Data |
| AF-17 | FAIL | No migrations at startup | Data |
| AF-18 | FAIL | No `CREATE EXTENSION` | Data |
| AF-19 | FAIL | No direct AI providers (OpenAI, Anthropic, Gemini endpoints or keys) | AI |
| AF-20 | WARN | The server sends a Content-Security-Policy with `frame-ancestors` and HSTS | Web security |
| AF-21 | FAIL | No third-party font or script CDNs (the CSP allows only the app's own origin) | Web security |
| AF-22 | FAIL | A committed lock file | Build, test, dependencies |
| AF-23 | WARN | With a database: an audit log written by the app | Data |
| AF-24 | WARN | No tokens in browser storage | Web security |
| AF-25 | FAIL | `build`, `test` and `lint` scripts (npm), or pytest and ruff configuration (Python), that run without prompts | Build, test, dependencies |
| AF-26 | FAIL | With an agent: `evals/` holds at least 20 synthetic cases | AI |
| AF-27 | FAIL | With an agent: actions are stored as proposals and run only after a person's decision | AI |
| AF-28 | FAIL | With a Copilot agent: Entra SSO, pinned tools (no dynamic discovery) in step with the server, a disclaimer, the SSO id gitignored | Sign-in; AI |
| AF-29 | WARN | With a Copilot agent: at least one tool pinned | AI |
| AF-30 | WARN | With `specs/`: no open `[NEEDS CLARIFICATION]` after planning, the AI Factory gates G1 to G7 filled (a note for FAIL and ASK) and signed off by a person, `features` in the build profile in step | Stop and ask a person first; Before you hand over |
| AF-31 | FAIL | No unsafe code shapes outside tests: TLS checks switched off, text run as code (`eval`, `new Function`, `pickle`), shell commands or SQL built from strings, raw HTML (`dangerouslySetInnerHTML`, `innerHTML =`), CORS open to every site. The code guard blocks the same shapes at write time, with AF-09 and AF-19 | Web security; `GUARD.md` step 3 |
| AF-32 | WARN | With pages (HTML, CSS, TSX, JSX, Vue or Svelte files): `AGENTS.md` states the browser support target with the sentence `This project's Baseline target is Baseline Widely available.` (another Baseline target is accepted). The scaffold writes it in "This project" | This project |
| AF-33 | WARN | No request body, headers or the whole `process.env` written to a log or `print` in server code (log ids and outcomes, not payloads) | Configuration and secrets; Logging |

For a standalone Copilot agent (`--kind copilot`, no container) the container rules (AF-02 to
AF-08, AF-10, AF-20) report SKIP.

The rules read TypeScript and Python alike where a rule has a form in both (for example `/healthz`,
timers such as APScheduler, `run_migrations()` at startup, `uv.lock`).

## Waivers

`.aifactory/build-check.json`:

```json
{ "waivers": [ { "id": "AF-08", "reason": "Writes only to /tmp for a transient export", "until": "2027-01-31", "by": "<name>" } ] }
```

A waiver shows as WAIVED until its date and as the original result after. Only a person adds a
waiver; Claude proposes, never writes one on its own.
