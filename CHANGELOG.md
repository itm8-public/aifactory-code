# Changelog

All notable changes. Versions follow SemVer; 0.x while the pinned build rules are a draft. A new
FAIL rule in the build check is listed under "May fail existing projects".

## 0.8.4 - 2026-11-22

- Removed internal names and references from docs and metadata: team names in the plugin
  metadata, private repository names, internal pull request and policy references, internal
  environment names, backlog identifiers in the G3 gate question, internal team and skill
  references in the design skill, and internal compliance wording in the model guidance.
- The G3 gate question in `templates/specs/gates.md`, and so the generated Spec Kit plan
  template and the gates table new projects get in `plan.md`, no longer carries backlog
  identifiers. Prose only: the gate ids and the Result and Note columns are unchanged, so no
  behaviour change.

## 0.8.3 - 2026-11-22

- Fixed: the gate installer's caller workflow now points at the published gate,
  `itm8-public/aifactory-gate` at `@v0`. It named an organization that does not exist, so the
  installed workflow could not resolve.

## 0.8.2 - 2026-11-20

Zone-aware production-readiness and governance steps, proportional to the solution's zone.

- New [production-readiness.md](skills/aifactory-code/reference/production-readiness.md): the
  production-readiness checklist, an ownership gate (a named system owner and business owner),
  security requirements verified as acceptance criteria, and the five POC-to-production gates
  surfaced. Applied to Yellow and Red; Green keeps only the free automated checks.
- `/aifactory-code:ship` gained a zone-aware production-readiness step before commit; `handover.md`
  and the `aifactory-code` skill point to the new checklist.
- Build check AF-33 (WARN): no request body, headers or the whole environment written to logs.

Naming of the five gates is provisional, pending the canonical order.

## 0.8.1 - 2026-11-20

Curation for the public (source-available) copy: internal platform identifiers mocked. No
behaviour change — guidance, templates and the build check are unchanged.

- `skills/aifactory-code/reference/hosting-lz-online.md` and `skills/foundry-agent/reference/models.md`:
  replaced concrete internal names (the shared Foundry account and project, the Foundry project
  endpoint, the shared subscription and landing-zone names, internal solution names and the
  internal platform repository) with placeholders the platform team fills in.
- Replaced internal process references (policy and backlog identifiers) with plain wording in
  `skills/aifactory-code/reference/stop-and-ask.md`, `skills/aifactory-code/SKILL.md` and
  `skills/foundry-agent/reference/models.md`.

## 0.8.0 - 2026-11-18

The itm8 AI Factory gate, installed from the plugin, and a plain-language way to a pull request.

- `/aifactory-code:gate` (`scripts/install-gate.mjs`): writes the caller workflow for the gate
  (`.github/workflows/aifactory-gate.yml`, which calls the aifactory-gate reusable workflow at
  `@v0` with the zone, responsibility level and test command), CODEOWNERS entries so changes to the
  gate need the itm8 review team, and a secret check that runs before every commit
  (`.aifactory/secret-check.mjs` with the plugin's secret patterns, `.githooks/pre-commit`). It
  works for commits from any tool, not only Claude Code. It asks before it writes, writes files
  only, and never commits, pushes or changes repository settings; itm8 turns on the ruleset and
  the environments.
- `/aifactory-code:ship`: look at the change, run the tests and the build check, branch, commit,
  push and open the pull request after the person says yes, then explain the gate's verdict
  (pass, fail with what to fix, or needs a person). Never merges, approves or deploys.
- The caller workflow signs in to nothing itself, so build check AF-09 still passes.

## 0.7.0 - 2026-11-17

A deterministic answer on every pull request: does a person have to look?

- Web app and MCP server template: `scripts/pr-verdict.ts` with unit tests, run as the last step
  of the CI `verify` job on pull requests. It writes `needs-a-person` or `no-escalation` to the
  job summary (and the step output `verdict`), with the reasons: the pull request touches identity
  or access code or configuration, a database migration, CI, deployment or infrastructure
  configuration, or a dependency manifest or lock file, or a check failed or did not run. The
  values and reasons match the Management app's push checks. It names areas, never file paths.
- The verdict blocks nothing (the step cannot fail the job), deploys nothing and calls no model.
  There is no AI review yet.
- CI steps in the template have ids, and the checkout fetches two commits, so the verdict can
  compare the merge commit with its base. Vitest also runs `scripts/**/*.test.ts`.
- README and the `web-app` skill: the verdict, and what the landing zone has to provide before a
  preview environment per pull request is possible.

### Not in this release

- No `--preview` option. The template has no deploy workflow, and the build rules, build check
  AF-09 and the code guard keep deploy pipelines out of the app repository. A preview per pull
  request needs a preview pipeline and identity from the landing zone first.

### May fail existing projects

- None. Existing projects are not changed; the build check has no new rule. To get the verdict in
  an existing project, copy `scripts/pr-verdict.ts`, its test and the CI step from a new scaffold.

## 0.6.0 - 2026-11-17

The builder bundle: stop the tool doing reckless things, and keep generated code on current
versions and current practice.

- Command guard (PreToolUse on Bash and PowerShell). Never runs: a recursive delete of `/`, `~`,
  a drive root or a `..` path outside the project; a force push to `main` or `master`; a download
  piped into a shell; a flag that switches off permission checks; a commit or push with
  `--no-verify`. Asks a person first: other force pushes, `git reset --hard`, `git clean -f`,
  `git branch -D`, tag deletes, `DROP` and `TRUNCATE` sent to a database, `az … delete`,
  `Remove-Az…`, `azd down`, `terraform destroy`, `kubectl delete`, `Remove-Item -Recurse -Force`
  outside the project, `npm publish`, `gh repo delete`, `docker system prune`.
  `AIFACTORY_COMMAND_GUARD=off` turns it off for a session.
- Protected files guard (PreToolUse on Write, Edit and MultiEdit): asks a person before a change
  to a CI workflow, a pipeline file, `infra/`, Bicep, Terraform, a Dockerfile, `CODEOWNERS` or a
  branch protection file. Only when the file exists and git tracks it, so a new file and a
  brand-new project are not asked about. `AIFACTORY_PROTECTED_FILES_GUARD=off` turns it off.
- Both guards are guidance, not a security boundary, and run in Claude Code only.
- New skill `current-versions`: look up the current stable version and the official documentation
  before writing code; no version from memory, no deprecated packages, the lock file kept, a major
  upgrade as its own change, and the project's Baseline target for web code.
- Three skills from obra/superpowers v7.0.2 @ 22f0b46 (MIT, Copyright (c) 2025 Jesse Vincent):
  `verification-before-completion`, `systematic-debugging` and `test-driven-development`, with
  small edits. Pinned per file in `vendor/superpowers.pin.json`; the licence text is in
  `THIRD_PARTY_NOTICES.md` and in each skill folder. No upstream hook or bootstrap is included.
- The marketplace lists Google Chrome's Modern Web Guidance plugin by repository, pinned to v1.0.1
  @ 64a6d70. Nothing is copied. The README covers its telemetry (`DISABLE_TELEMETRY=1`), its
  unpinned `npx` call and the frozen copy in `claude-plugins-official`.
- Build check AF-32 (WARN): a project with pages states its browser support target in `AGENTS.md`.
  The scaffold writes the line for the web app and the Python agent.
- README: "Install in your tool" for Claude Code, GitHub Copilot CLI and the hosted builders
  (Lovable, Bolt, Replit, Base44), and what is enforced where.
- `npm run vendor:drift` also reports a newer release than a pinned tag, for the superpowers
  skills and the Modern Web Guidance entry.

### May fail existing projects

- None fails. AF-32 is a WARN on a project with pages whose `AGENTS.md` lacks the Baseline target
  sentence: add it to "This project".
- The two new guards may prompt or block in any project, not only AI Factory projects. For a false
  positive, use the guard's off switch and tell the maintainers.
- Build rules re-pinned to kit 0.2 at `9c85dc4`: current versions, the Baseline target, actions
  that need a person, and where hosted builders read the rules. It also brings the 2026-11-11 kit
  changes (no-app platforms, shared resources).
- Python agent template: `opentelemetry-api` 1.45.2 (CVE-2026-126360 in 1.45.1 failed the
  dependency audit).

## 0.5.0 - 2026-11-05

One change gate for security, the smallest change and the AI Factory rules, enforced from the
first write.

- Rules pin: build-kit 0.1 @ 09c48e5. New pinned files `GUARD.md` (the change gate) and
  `PERFORMANCE.md`; `AGENTS.md` points to both. The scaffold writes them to the project root and
  every `CLAUDE.md` imports them; `/aifactory-code:update-rules` copies them too.
- The change gate, adapted from Ponytail (MIT) and Cloudflare's security-audit skill (MIT): scope,
  stop and ask, one line per trust boundary with a refusal test, then the smallest change. The
  build rules win, security comes second, the smallest change last. The `aifactory-code` skill
  runs it before every change and ends each answer with what was skipped or not checked.
- Feature plans: G6 is the smallest-change ladder (never by cutting a control); new gate G7
  Security holds the boundary lines, and tasks get a refusal test per line. Bug fixes at a
  boundary start with a refusal test. Spec Kit preset: constitution principle VIII and gate G7.
- Code guard (PreToolUse, AI Factory projects only): denies infrastructure files, deploy steps,
  direct AI providers and unsafe code shapes in the new text, outside tests.
  `AIFACTORY_CODE_GUARD=off` turns it off for a session.
- Build check AF-31 (FAIL): the same unsafe code shapes. AF-09 and AF-19 now share their patterns
  with the code guard (`lib/code-guard.mjs`); their results do not change.
- `security-audit` skill: Cloudflare's skill @ c1c8a8c, unchanged, pinned per file in
  `vendor/security-audit.pin.json`; `npm run vendor:drift` in the weekly drift workflow.
- Hand-over: the `GUARD.md` checklist and a full source audit.

### May fail existing projects

- AF-31 (FAIL) on code with one of the unsafe shapes. A person may add a waiver with a reason and
  an end date.
- AF-30 (WARN) on plans written before G7: add the G7 row and sign again.

## 0.4.0 - 2026-10-29

A light spec-first flow per feature, adapted from GitHub Spec Kit (MIT). Released after 0.3.0.

- `/aifactory-code:spec`: `specs/NNN-slug/spec.md` with prioritised user stories (given, when,
  then), FR and SC ids, key entities, a "Data and zone (AI Factory)" section that raises
  stop-and-ask items early, and `[NEEDS CLARIFICATION: …]` markers.
- `/aifactory-code:plan`: refuses while the spec has an open marker; writes `plan.md` with the
  technical context from the build profile and the AI Factory gates G1 to G6 (data and zone, stop
  and ask, ask itm8, build rules, AI, smallest change). Claude fills the gates; a person signs
  them off. Also writes `tasks.md` (T001, `[P]`, `[US1]`, tests first, the build check last).
- `/aifactory-code:fix`: `specs/bugs/BNNN-slug/report.md`, a failing test before the fix, and a
  verdict (verified, partial, failed).
- `scripts/feature.mjs` (new, plan, bug, list, sync) and the new `feature-specs` skill.
- Build profile: `features` lists each spec's id, title, status, open clarifications and
  sign-off, derived from `specs/`. New projects get `specs/README.md` and `features: []`.
- Build check AF-30 (WARN): open clarifications after planning, gates unfilled or unsigned, FAIL
  or ASK without a note, `features` out of step with `specs/`.
- Spec Kit preset `presets/speckit-aifactory` (verified with specify-cli 1.2.5, CI job
  `speckit-preset`): AGENTS.md as the constitution, the data-and-zone section, the gates, the
  build check at the end of tasks and implement.

### May fail existing projects

- None: AF-30 is a WARN and only looks at `specs/`.

## 0.3.0 - 2026-10-29

Microsoft 365 Copilot agents. Released after 0.2.0.

- `--copilot` on a web app with `--mcp` or on `--kind mcp`: a declarative agent (Microsoft 365
  Agents Toolkit) in `copilot/` that calls the app's `/mcp` with Entra SSO (`OAuthPluginVault`).
- `--kind copilot --mcp-url …`: the same agent as its own project for an existing MCP server.
- Pinned tool list: `npm run copilot:tools` generates `mcp-tools.json` from `MCP_TOOLS` (input
  schemas), `scripts/sync-tools.mjs` keeps `ai-plugin.json` in step; `--check` modes in CI.
- Tokens from Copilot's token store (`ab3be6b7-…`) are accepted on `/mcp` only.
- Manifests: app 1.22, declarative agent 1.9, plugin 2.4 (itm8's production combination); CI
  validates with the Agents Toolkit CLI 1.1.18 (schema and validation rules).
- New skill `copilot-agent`. Build check AF-28 (SSO, pinned tools in step, disclaimer) and AF-29
  (tools pinned); container rules report SKIP for a standalone Copilot project. Developer tooling
  (`scripts/`, `copilot/`, `evals/`) no longer counts as server code.

### May fail existing projects

- None: AF-28 and AF-29 apply only with `addons.copilot`.

## 0.2.0 - 2026-10-29

Agents and MCP. Released after the 0.1.0 pilot feedback is in.

- `--kind agent`: a Python agent on Microsoft Agent Framework (agent-framework-foundry 1.15,
  -openai 1.17) in one FastAPI container with a chat page; `FoundryChatClient` for a project
  endpoint, `OpenAIChatClient` for an account or gateway endpoint; PostgreSQL via psycopg with
  Entra tokens; SQL migrations with runtime-role grants; uv lock; tests; CI.
- `--agent` on a web app: Foundry tool calling with a fixed tool list, bounded to 4 steps and
  25 seconds; the browser keeps the conversation.
- Both agents use propose-then-approve: the model can only store a proposal; the user approves it
  in the app and the server runs it in a transaction with an audit row. Evaluation set of 20
  synthetic cases and a scoring command.
- `--kind mcp` and `--mcp`: a stateless Streamable HTTP MCP endpoint at `/mcp` behind Easy Auth,
  read-only tools, every call audited with an argument hash.
- New skills `foundry-agent` and `mcp-server`; design interview and core skill updated.
- Build check: AF-26 (agent evaluation set), AF-27 (agent approval gate); AF-17, AF-22 and AF-25
  read Python projects.

### May fail existing projects

- None: AF-26 and AF-27 apply only when the build profile has `addons.agent`.

## 0.1.0 - 2026-10-29

First pilot release.

- Design interview and `/aifactory-code:new`: one base kind (web app) with optional PostgreSQL and
  AI calls; agent, MCP and Copilot needs are recorded as "ask itm8".
- Web app template: Fastify 5 + React/Vite in one container on port 8080, Easy Auth principal,
  security headers and cross-site guard, PostgreSQL via Drizzle with Entra token auth, migration
  command with runtime-role grants and an append-only audit log, Azure AI Foundry client with
  per-user limit, tests (Vitest against PostgreSQL), Dockerfile pinned by digest, CI workflow.
- `itm8-design` skill: tokens from the Claude Design itm8 Design System, React components,
  self-hosted fonts. Fixes from the source: a real white logo, no red error colour.
- Build check `AF-01` to `AF-25`, waivers in `.aifactory/build-check.json`.
- Secret guard hook for Write, Edit and MultiEdit.
- Rules pin: build-kit 0.1 @ 861542b.
