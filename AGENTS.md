# Maintaining aifactory-code

This repository is a Claude Code plugin and its own marketplace
(`.claude-plugin/marketplace.json`, `source: "./"`). The marketplace also lists one third-party
plugin by repository, Modern Web Guidance, pinned to a release tag and a commit; `npm run check`
refuses an entry without a full commit sha, and `npm run vendor:drift` reports a newer release. Users install it; changes here reach every
colleague who updates, so keep them small and tested.

## Commands

| Command | What it does |
|---|---|
| `npm run check` | Manifests, skill and command frontmatter, Markdown links, the rules pin, template markers and JSON |
| `npm test` | Node test runner: the guards, build check rules (a failing case per rule), scaffold matrix |
| `npm run scaffold -- --help` | Create a project from the templates |
| `npm run build-check -- <folder>` | Run the build check |
| `npm run vendor:drift` | Has a vendored third-party skill moved upstream, or has a pinned tag a newer release (exit code 3)? |
| `npm run vendor:sync -- <name> --ref <sha>` | Re-pin a vendored skill that is shipped unchanged, after reading the upstream diff |

No runtime dependencies: scripts use Node 22+ built-ins only.

> The build rules in `rules/build-kit/` are mirrored from itm8's internal AI Factory build-kit.
> Re-pinning them against the upstream repository is an itm8-internal maintenance step and is not
> part of this public copy; `npm run check` still verifies the shipped copies against `rules/pin.json`.

## Layout

- `skills/<name>/SKILL.md` is the canonical instruction; `commands/*.md` are thin adapters.
- `rules/build-kit/` is a pinned, byte-exact copy of the upstream build rules, including
  `GUARD.md`, the change gate the skills and the scaffold point to. Never edit it. The upstream
  rule repository and the re-pinning step are itm8-internal and not part of this public copy.
- `skills/security-audit/` is Cloudflare's security-audit skill (MIT), shipped unchanged and pinned
  in `vendor/security-audit.pin.json` (SHA-256 per file, checked by `npm run check`). Never edit
  it; itm8's own rules about when it runs live in the `aifactory-code` skill and `GUARD.md`.
- `skills/verification-before-completion/`, `skills/systematic-debugging/` and
  `skills/test-driven-development/` come from obra/superpowers (MIT), pinned to a release tag in
  `vendor/superpowers.pin.json`: the upstream hash per file and, for the four files we edited, the
  hash of our copy (`localSha256`). Touch them only to move to a newer tag, by hand, as the pin's
  note says. Never bring in upstream hooks, bootstraps or the `using-superpowers` skill.
- `lib/code-guard.mjs` holds the unsafe-code shapes shared by the code-guard hook and AF-09, AF-19
  and AF-31; `lib/secrets.mjs` does the same for the secret guard and AF-11.
- `lib/command-guard.mjs` holds the command guard's rules, in two tiers (deny, ask). A rule looks
  at a command already split into words, never at the raw text. A new rule needs a deny or ask case
  and a pass case in `tests/command-guard.test.mjs`. `lib/hook.mjs` is the shared hook plumbing
  (read stdin, print one decision, fail open). `lib/protected-files.mjs` lists the CI, deployment
  and infrastructure paths the protected-files guard asks about.
- `templates/web-app/` is the TypeScript starter for `--kind web` and `--kind mcp`. Flags:
  `spa` (web kind), `db`, `ai`, `agent`, `mcp` (`flagsOf()` in `scripts/scaffold.mjs`). Text files
  may contain `@if flag` / `@if !flag` blocks (comment lines in the file's own syntax, nestable) and
  single-line `<!-- @if x -->…<!-- @endif -->` in Markdown (never nest those). `template.json` lists
  files that exist only with a flag (a file under several flags needs all of them).
- `templates/agent-python/` is the Python starter for `--kind agent` (no flags). Format and lint
  it with ruff (line length 110) before committing.
- `templates/copilot-agent/` is the Copilot package: rendered into `copilot/` for `--copilot`
  (flags `addon`, `db`) or as the project for `--kind copilot` (flag `standalone`). Its
  `appPackage/mcp-tools.json` and `ai-plugin.json` must equal what `npm run copilot:tools` produces
  from the web-app template's `MCP_TOOLS`: when you change a template tool, regenerate in a
  scaffolded project and copy the result back with the `@if addon` / `@if db` blocks.
- `templates/specs/` holds the feature-spec templates that `scripts/feature.mjs` fills (tokens
  `__FEATURE__`, `__ID__`, `__DATE__`, `__INPUT__`, `__CONTEXT__`, `__GATES__`) and the
  `specs/README.md` every scaffold gets. `gates.md` is the single source of the AI Factory gates;
  the parsers in `feature.mjs` (shared with AF-30) read its table and sign-off line, so change
  them together.
- `presets/speckit-aifactory/` is the GitHub Spec Kit preset. Its `templates/spec-template.md`,
  `plan-template.md` and `tasks-template.md` are generated from `templates/specs/` by
  `node scripts/build-preset.mjs` (`npm run check` fails on drift); the constitution and the
  `speckit.implement` wrapper are written by hand. Keep `preset.yml` `version` equal to the plugin
  version, and re-verify with the `speckit-preset` CI job when you move the Spec Kit pin.
- Tokens: `__APP__`, `__TITLE__`, `__PLUGIN_VERSION__`, `__KIT_VERSION__`, and the package name
  `aifactory-app-template` (also inside the lock files).
- `templates/web-app/locks/` holds one npm lock per dependency signature (`lockSignature()`:
  `spa`, `spa-db`, `spa-db-mcp`, `api-mcp`, `api-db-mcp`). When you change dependencies, scaffold
  each signature, `npm install`, and copy `package-lock.json` back with the name replaced by
  `aifactory-app-template`. `templates/agent-python/uv.lock` is regenerated with `uv lock` in the
  template folder (Python 3.13).
- `templates/web-app/drizzle/` holds generated migrations; regenerate with drizzle-kit, never by
  hand, and add the journal entry with the matching `@if` block.
- `skills/itm8-design/kit/` is the single source of the design kit; the scaffold copies it into
  `src/web/design/`. Tokens are byte-identical to the Claude Design system and the Management app.

## Rules for changes

- Smallest change that solves the problem. Reuse what is here before adding a file or a helper.
- A change to a build-check rule needs a failing case in `tests/build-check.test.mjs`.
- A change to a template must keep every variant in `templates.yml` passing lint, typecheck,
  tests, build, the build check and a container build.
- Bump `version` in `.claude-plugin/plugin.json` for every release (the install cache is keyed
  by version) and add a CHANGELOG section.
- No customer names, tenant or subscription ids, or secrets anywhere, including tests (build
  secret-shaped test strings by concatenation).
