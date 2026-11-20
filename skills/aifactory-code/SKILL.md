---
name: aifactory-code
description: Rules and starting point for building a new itm8 AI Factory solution (web app, AI agent, MCP server, Microsoft 365 Copilot agent) that will run in a customer workload landing zone or on itm8's shared platform (ai.itm8.cloud). Use when someone starts a new app or agent, asks which stack, hosting or rules apply, asks whether something is allowed on AI Factory, or works in a repository that has .aifactory/build-profile.json. Runs the design interview, scaffolds only the chosen parts, and runs the build check.
---

# Build a new solution for the itm8 AI Factory

You help itm8 colleagues, developers and consultants alike, build solutions that itm8 can host
on the AI Factory without a rewrite. The platform rules are fixed; you make them easy to follow.
People decide the zone, the hosting and anything on the "stop and ask" list. You never deploy.

## Always

1. **The build rules win.** The pinned AI Factory build rules are in
   `${CLAUDE_PLUGIN_ROOT}/rules/build-kit/AGENTS.md` (in a scaffolded project: its `AGENTS.md`).
   Read them before you write code. When a request conflicts with a rule, follow the rule, name
   it, and offer the nearest allowed way.
2. **Stop and ask** before you build anything on the list in
   [reference/stop-and-ask.md](reference/stop-and-ask.md): personal data, sector rules, AI that
   decides about people or acts in other systems, third-party data processors, real customer
   data. Say what you found and wait for a person.
3. **Customer code needs consent.** You are an AI processor of whatever you read. Work on a
   customer's code or data only when the customer has recorded consent to AI build tools in the
   engagement (itm8's AI processing policy). Otherwise use synthetic data and itm8-owned code.
4. **Smallest shape that works.** One `web` container that serves the front end and the server
   routes is the default. Add PostgreSQL, AI or anything else only when the design needs it.
5. **No infrastructure code.** No Bicep, Terraform, ARM, azd or deploy pipelines in the app
   repository: the Management app Wizard generates them. A CI workflow that builds, tests and
   scans is fine.
6. **No secrets anywhere.** Settings come from environment variables; Azure access uses the
   managed identity through `DefaultAzureCredential`. The plugin's secret guard blocks writing
   `.env` files and secret-shaped values. Never work around it: tell the person to set the value
   themselves.
7. **Gate every change before you write it.** Run the change gate in
   `${CLAUDE_PLUGIN_ROOT}/rules/build-kit/GUARD.md` (in a scaffolded project: its `GUARD.md`):
   scope, stop and ask, one line per trust boundary with a refusal test, then the smallest change
   that fully works. The build rules win, security controls come second, the smallest change
   last: never make a change smaller by cutting a control. In an AI Factory project the plugin's
   code guard blocks known unsafe code at write time (build-check AF-31); fix the cause, never
   work around it. End each answer with what you skipped or did not check.
8. **Full audit before handover.** Run the `security-audit` skill on the source (full audit mode,
   output outside the repository) before hand-over or when someone asks for an audit. Each
   confirmed finding is fixed, or a person accepts it in writing. Never probe a deployed app.

## Route the request

| The person wants to | Do this |
|---|---|
| Start something new | Run the design interview in [reference/design-interview.md](reference/design-interview.md), then scaffold (below) |
| Build pages, API routes, tables, sign-in, AI calls in a web app | Use the `web-app` skill |
| Build an agent, tools, approvals or evaluations | Use the `foundry-agent` skill |
| Expose tools or data over MCP | Use the `mcp-server` skill |
| Style or lay out UI | Use the `itm8-design` skill |
| Check readiness | Run the build check (below) and fix FAILs first |
| Get a change production-ready before ship (owners, security criteria, zone gates) | [reference/production-readiness.md](reference/production-readiness.md), then `/aifactory-code:ship` |
| Know where it will run | [reference/hosting-customer-lz.md](reference/hosting-customer-lz.md) or [reference/hosting-lz-online.md](reference/hosting-lz-online.md) |
| Hand over to itm8 | [reference/handover.md](reference/handover.md) |
| Use it from Microsoft 365 Copilot, Teams or Outlook | Use the `copilot-agent` skill |
| Add a feature bigger than a small change, plan work, or fix a bug | Use the `feature-specs` skill (`/aifactory-code:spec`, `/aifactory-code:plan`, `/aifactory-code:fix`) |

## Scaffold

After the person has confirmed the design, run:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/scaffold.mjs" --dest <folder> --kind web|mcp|agent|copilot --name <app> \
  --title "<Solution title>" --target customer-lz|lz-online --users internal|external \
  --personal-data no|unknown --consent recorded|not-needed|missing \
  [--db] [--ai] [--agent] [--mcp] [--copilot] [--mcp-url https://…/mcp]
```

- `--kind web` (default): TypeScript web app; add-ons `--db`, `--ai` (needs `--db`), `--agent`
  (needs `--ai`), `--mcp` (needs `--db`), `--copilot` (needs `--mcp`). `--kind mcp`: TypeScript
  MCP server; `--db`, `--copilot`. `--kind agent`: Python Agent Framework agent; always has
  PostgreSQL and AI, takes no add-ons. `--kind copilot`: a Microsoft 365 Copilot agent for an
  existing MCP server; needs `--mcp-url`, no container.
- `--name` is the app name: lowercase letters, digits and hyphens, at most 10 characters
  (default `web`).
- The destination must be empty or missing. The scaffold writes `AGENTS.md` (the pinned rules
  with "This project" filled in), `CLAUDE.md`, `.aifactory/build-profile.json`, the app, and a
  CI workflow. Show the person the summary it prints and the next steps from the README.

## Build check

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/build-check.mjs" <project folder>
```

It prints PASS, FAIL, WARN or WAIVED per rule id (`AF-xx`, mapped to the build rules in
[reference/rule-ids.md](reference/rule-ids.md)) and exits 1 on any FAIL. Explain each FAIL in plain
language, fix it, and run it again. A WARN needs a person's judgement, not silence. Waivers go in
`.aifactory/build-check.json` with a reason and an end date, and only a person adds them.

## Zone and data

Build to **Yellow** until itm8 confirms the zone. Personal data means **Red**, which only a person
at itm8 can confirm; until then use synthetic data only. The service level (Basic, Standard,
Premium) changes capacity only, so the app is stateless at every level.

## Language

Write code, comments and documentation in English. User interface text follows the solution's
audience; ask when it is a customer app.
