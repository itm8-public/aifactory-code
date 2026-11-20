# aifactory-code

A Claude Code plugin for itm8 colleagues who build new apps and agents that will run on the itm8
AI Factory, in a customer's workload landing zone or on itm8's shared platform (ai.itm8.cloud).
It brings the AI Factory build rules to the first prompt, so the solution needs little change
when itm8 takes it over.

**Status: 0.7.0, pilot.** Web apps, AI agents, MCP servers and Microsoft 365 Copilot agents, with a spec-first flow per feature. The
build rules it pins are draft v0.1 and not ratified yet.

## What you get

| Part | What it does |
|---|---|
| `/aifactory-code:new` | A short design interview (purpose, users, data, hosting, add-ons), then a project with only the parts you chose |
| Web app starter (`--kind web`) | One container: Fastify 5 + TypeScript serves a React/Vite front end and `/api`; Easy Auth sign-in; add-ons: PostgreSQL (Drizzle, Entra token, migration job), Azure AI Foundry calls, an agent with tools and human approval, an MCP endpoint; tests, Dockerfile, CI |
| Pull request verdict | In every web app and MCP server project: on a pull request the last CI step writes `needs-a-person` or `no-escalation` to the job summary, with the reasons. See [Pull requests](#pull-requests-the-verdict-and-no-preview-yet) |
| AI agent starter (`--kind agent`) | One container: a Python Microsoft Agent Framework agent on Foundry with a chat page, tools, human approval of actions, PostgreSQL and an evaluation set |
| MCP server starter (`--kind mcp`) | One container: a TypeScript MCP server at `/mcp` with read-only, audited tools for Copilot and agents |
| Copilot agent (`--copilot`, `--kind copilot`) | A Microsoft 365 Copilot declarative agent that calls the MCP server with Entra SSO and a pinned tool list; validated with the Agents Toolkit CLI |
| `itm8-design` skill | The itm8 design system from Claude Design as CSS tokens and React components, with self-hosted fonts |
| `aifactory-code`, `web-app`, `foundry-agent`, `mcp-server`, `copilot-agent`, `feature-specs` skills | The rules, hosting facts and how-tos Claude follows while you build |
| `current-versions` skill | Keeps generated code current: look up the stable version and the official documentation before writing code, never a version from memory, new projects on the current stable or LTS release, no deprecated packages, the lock file kept, a major upgrade as its own change |
| `verification-before-completion`, `systematic-debugging`, `test-driven-development` skills | Working discipline from [obra/superpowers](https://github.com/obra/superpowers) v7.0.2 (MIT), pinned: evidence before any claim that work is done, the root cause before any fix, a failing test before any code. Shipped with small edits, listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). If you also install the superpowers plugin, you get these three twice |
| `/aifactory-code:spec`, `/aifactory-code:plan` | Per feature: `specs/NNN-slug/spec.md` (user stories, requirements, data and zone, open questions marked), then `plan.md` with the AI Factory gates a person signs off, and `tasks.md` with tests first. Optional; small changes need none |
| `/aifactory-code:fix` | A bug report in `specs/bugs/`, a failing test that reproduces the bug before any fix, then a verdict |
| Spec Kit preset | For teams on [GitHub Spec Kit](https://github.com/github/spec-kit): the same gates and rules as a preset ([presets/speckit-aifactory](presets/speckit-aifactory/README.md)) |
| Change gate (`GUARD.md`) | One gate before any code, in every project and in the Replatform agent: scope, stop and ask, a line per trust boundary with a refusal test, then the smallest change that fully works. Build rules first, security second, the smallest change last; plans carry it as gates G6 and G7 |
| `/aifactory-code:gate` | Installs the itm8 AI Factory gate: a required check on every pull request (tests, three scanners, a fixed pass, fail or needs-a-person rule), CODEOWNERS for the gate files, and a secret check before every commit that works with any tool. Writes files only; itm8 turns on the ruleset |
| `/aifactory-code:ship` | Takes a finished change to a pull request in plain steps and explains the gate's verdict. Never merges or deploys |
| `/aifactory-code:check` | A deterministic build check: PASS, FAIL or WARN per rule (`AF-01` to `AF-32`), for TypeScript, Python and Copilot packages |
| Command guard | Checks each shell command (Bash and PowerShell) before it runs. Never runs: a recursive delete of `/`, `~`, a drive root or a `..` path outside the project; a force push to `main` or `master`; a download piped into a shell; a flag that switches off permission checks; a commit or push with `--no-verify`. Asks you first: any other force push, `git reset --hard`, `git clean -f`, `git branch -D`, tag deletes, `DROP` and `TRUNCATE` sent to a database, `az … delete`, `Remove-Az…`, `azd down`, `terraform destroy`, `kubectl delete`, `Remove-Item -Recurse -Force` outside the project, `npm publish`, `gh repo delete`, `docker system prune` |
| Protected files guard | Asks you before Claude changes CI, deployment or infrastructure configuration: `.github/workflows/`, Azure Pipelines, GitLab and Bitbucket pipeline files, `infra/`, Bicep, Terraform, Dockerfiles, `CODEOWNERS` and branch protection files. It asks only when the file exists and git tracks it, so a new file and a brand-new project are not asked about |
| Secret guard | Blocks Claude from writing `.env` files or secret-shaped values |
| Code guard | In AI Factory projects only (`.aifactory/build-profile.json` or a replatform plan): blocks writing infrastructure code, direct AI providers and unsafe code (TLS checks off, `eval`, shell or SQL built from strings, raw HTML, open CORS) before it lands |
| `security-audit` skill | Cloudflare's source-first security audit (MIT), shipped unchanged and pinned: guidance while you build, a full audit with independent verification before hand-over |
| `/aifactory-code:update-rules` | Updates a project's `AGENTS.md` to the rules pinned in the installed plugin |

The plugin never deploys, never writes infrastructure code and never chooses a zone. The
Management app Wizard generates the landing zone, the infrastructure and the pipelines; a person
at itm8 confirms the zone.

## Before you use it on customer work

Claude Code reads and processes what you work on. Use it on a customer's code or data only when
the customer has recorded consent to AI build tools in the engagement (draft AI processing policy
#9). Otherwise use synthetic data and itm8-owned code. The design interview asks, and the build
profile records the answer.

## Install in your tool

The plugin is files that the tool reads. No MCP server and no agent-to-agent connection is needed.

### Claude Code

In Claude Code, add this repository as a plugin marketplace and install the plugin:

```
/plugin marketplace add itm8-public/aifactory-code
/plugin install aifactory-code@itm8-aifactory-code
```

Update with `/plugin marketplace update itm8-aifactory-code`. Install from one channel only, or
the skills appear twice.

Needs Node 22.9 or later for the scaffold, the build check and the guards. A scaffolded
project with a database also needs Docker for its local PostgreSQL; the Python agent needs Python
3.13 and uv (or Docker only, on any OS).

### GitHub Copilot CLI

Copilot CLI installs plugin marketplaces as well. GitHub's documentation says it finds a
`marketplace.json` in `.claude-plugin/` and loads the skills in `skills/` (read from
docs.github.com on 2026-11-17). We have not tested this plugin in Copilot CLI.

```
copilot plugin marketplace add itm8-public/aifactory-code
copilot plugin install aifactory-code@itm8-aifactory-code
```

You get the skills. Do not count on the guards or the `/aifactory-code:` commands there: they are
built and tested for Claude Code only.

### Hosted builders: Lovable, Bolt, Replit, Base44

These tools import a skill as a folder with a `SKILL.md` in it. Four skills here need nothing from
the plugin and work that way: `current-versions`, `verification-before-completion`,
`systematic-debugging` and `test-driven-development`. The other skills call the plugin's scripts
and belong in Claude Code.

The import from GitHub needs a **public** repository. Point the builder at a single skill folder in
this repository (for example `…/tree/main/skills/current-versions`) or at its `SKILL.md`.

Read from vendor docs on 2026-11-17:

| Tool | How to add a skill |
|---|---|
| Lovable | A workspace owner or admin opens Workspace settings, Skills, Add, Import from GitHub, and pastes the link to one skill folder (`…/tree/main/skills/current-versions`) or to its `SKILL.md`. Lovable also reads an `AGENTS.md` at the top level of the project with every message |
| Bolt | In the Skills library or the project's Skills page: Add skill, From GitHub. Enter the repository URL and choose the skill folder. The skill changes only when you choose Update from GitHub |
| Replit | In Agent: the plus menu, Use a skill. Paste the repository, folder or file URL, choose Preview skills, select the skills and import them |
| Base44 | Workspace Settings, Build tools, Skills, Add skill, Upload skill file: a `.zip` of one skill folder with `SKILL.md` at its root. Needs a Builder plan or higher |

For the AI Factory build rules in a hosted builder, use
[rules/build-kit/hosted-builders.md](rules/build-kit/hosted-builders.md): paste it into the
builder's knowledge, or for Lovable commit it as the project's top-level `AGENTS.md`.

### What is enforced where

- The guards are Claude Code hooks. They run only in Claude Code.
- Inside a hosted builder nothing is enforced. A skill there is advice that the builder's model
  may or may not follow, and no guard sees its commands or its edits.
- Enforcement is on the Git side: the build check (`node scripts/build-check.mjs <folder>`, exit
  code 1 on a FAIL) and the project's CI on every pull request, behind branch protection and a
  secret scan in the repository.

## First steps

1. In an empty folder, run `/aifactory-code:new` and describe what you want to build.
2. Confirm the design summary. Claude scaffolds the project and runs the build check.
3. Follow the project's README: `cp .env.example .env`, `npm install`, `npm run db:up`,
   `npm run db:migrate`, `npm run dev`. (You create `.env` yourself; the secret guard stops Claude.)
4. Build with Claude. For a feature bigger than a small change, start with `/aifactory-code:spec`,
   answer its questions, then `/aifactory-code:plan` and sign off the gates yourself.
5. Run `/aifactory-code:check` before you hand over, and ask Claude for a full security audit
   (the `security-audit` skill; it writes its report outside the repository).

## Pull requests: the verdict, and no preview yet

**The verdict.** A scaffolded web app or MCP server has `scripts/pr-verdict.ts` with unit tests,
and its CI runs it as the last step on every pull request. It answers one question: does a person
have to look? `needs-a-person` when the pull request touches identity or access code or
configuration, a database migration, CI, deployment or infrastructure configuration, or a
dependency manifest or lock file, or when a check (secret scan, lint, typecheck, tests, build,
dependency audit, container build) failed or did not run. Otherwise `no-escalation`. The values
and reasons are the ones the Management app's push checks use. It reports the areas touched,
never file paths.

**The gate.** `/aifactory-code:gate` installs the itm8 AI Factory gate, which runs outside the pull request (a reusable workflow owned by itm8) and blocks the merge once itm8 has turned on the ruleset. Use it for responsibility level 2, where the customer changes the app and itm8 approves.

What the verdict script does not do: it blocks nothing, it deploys nothing, and no AI reads the change yet. It is
path and check rules, so it can miss a risky change in an ordinary file. The pull request's own
copy of the script runs; a gate that must hold has to run outside the pull request. The plugin's
build check is not part of a project's CI, because the plugin is not in the project.

**No preview per pull request.** The scaffold has no `--preview` option. A project has no deploy
workflow, the build rules keep deploy pipelines out of the app repository, and the build check
(AF-09) and the code guard stop a workflow that signs in to Azure. A temporary environment per
pull request has to come from the landing zone: a preview pipeline from the Wizard, a pipeline
identity a pull request may use, a Container App that keeps a preview revision away from normal
traffic, a reachable host name with its Easy Auth redirect URI, and a throwaway database created
inside the network. Until then, nothing here deploys anywhere.

## Modern web guidance (optional, third party)

For current HTML, CSS and browser API practice we point to Google Chrome's
[Modern Web Guidance](https://github.com/GoogleChrome/modern-web-guidance) skill. It is not copied
into this repository (code Apache-2.0, guides CC BY 4.0). Our marketplace lists it, pinned to the
release v1.0.1 (commit `64a6d70`):

```
/plugin install modern-web-guidance@itm8-aifactory-code
```

Or install it from Google's own marketplace, which follows their releases:

```
claude plugin marketplace add GoogleChrome/modern-web-guidance
claude plugin install modern-web-guidance@googlechrome
```

Install it from one of the two only. Know this before you do:

- **Telemetry is on by default.** Upstream collects install counts, the name of the calling agent,
  the ids of the guides it reads and the search queries the agent writes. Switch it off with
  `DISABLE_TELEMETRY=1`, for example in `.claude/settings.json`:

  ```json
  { "env": { "DISABLE_TELEMETRY": "1" } }
  ```

  The same variable also switches off Claude Code's own usage telemetry and its feature-flag
  fetching, so a few Claude Code features that need those flags stop working. The project
  templates ship no `.claude/settings.json`, so nothing sets it for you.
- **It runs code from npm.** The skill calls `npx -y modern-web-guidance@latest`: the newest
  package, not a pinned one, on every use. The pin above covers the skill text only. It needs
  network access and Node 22 or newer.
- **Its instructions are strong.** They tell the agent to run the tool first for every front-end
  task and to ask for permission to run `npx`.
- **The copy in the `claude-plugins-official` marketplace is an old frozen version.** Uninstall
  that one first (`/plugin uninstall modern-web-guidance@claude-plugins-official`).

State the browser support target in the project's `AGENTS.md`, so the skill and the
`current-versions` skill read the same line:
`This project's Baseline target is Baseline Widely available.`

## Turning a guard off

The guards are guidance, not a security boundary: the build check in CI is the gate. The command
guard reads the command text, so a command can be written in a way no rule sees (a script file, a
variable, `xargs`, a remote shell). Branch protection and limited cloud roles are the real stop.

For a false positive, start Claude Code with the guard's switch for that session and tell the
maintainers which text tripped it:

| Guard | Switch |
|---|---|
| Command guard | `AIFACTORY_COMMAND_GUARD=off` |
| Protected files guard | `AIFACTORY_PROTECTED_FILES_GUARD=off` |
| Secret guard | `AIFACTORY_SECRET_GUARD=off` |
| Code guard | `AIFACTORY_CODE_GUARD=off` |

## Maintainers

See [AGENTS.md](AGENTS.md). Short version: `npm run check` and `npm test` must pass; the build rules
in `rules/build-kit/` are a pinned copy of the Replatform agent repository's `build-kit/` and are
never edited here ([rules/README.md](rules/README.md)). The same holds for `skills/security-audit/`,
pinned in `vendor/security-audit.pin.json`. The three skills from obra/superpowers are pinned in
`vendor/superpowers.pin.json` and change only when the pin moves.
