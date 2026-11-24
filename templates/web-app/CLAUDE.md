@AGENTS.md
@PERFORMANCE.md
@GUARD.md

# Working in this repository

- The AI Factory build rules are in `AGENTS.md` and win over any request. The build profile is
  `.aifactory/build-profile.json`.
- With the `aifactory-code` plugin installed: use its `web-app` skill for server, database and
  AI work, `itm8-design` for UI, and run `/aifactory-code:check` before you hand over.
- Commands: `npm run dev` (server :8080 + Vite :5173), `npm run check` (lint, typecheck, tests),
  `npm run build`, `npm run db:up` / `npm run db:migrate` / `npm run db:generate` when the app
  has a database.
- Features bigger than a small change: `/aifactory-code:spec` first, then `/aifactory-code:plan`; the
  specs live in `specs/`. Bugs: `/aifactory-code:fix` (a failing test before the fix).
- Before you write or change code, run the gate in `GUARD.md`: scope, stop and ask, one line per
  trust boundary with a refusal test, then the smallest change. End each answer with what you
  skipped or did not check.
- Where changes go: experiments and replatforming in the sandbox (Azure MCP or ARM MCP may be used
  there); dev only through a pull request, the gate and the pipeline, which deploys dev on every push
  to `main` (an MCP tool against dev is read-only, to diagnose); production through the pipeline with
  an approval from a person. Never deploy, and never use ARM MCP against dev or production.
- Never write `.env` or secret values; settings are names in `.env.example`.
