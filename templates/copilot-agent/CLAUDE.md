@AGENTS.md
@PERFORMANCE.md
@GUARD.md

# Working in this repository

- This is a Microsoft 365 Copilot declarative agent (Microsoft 365 Agents Toolkit). The AI Factory
  build rules in `AGENTS.md` still apply; the build profile is `.aifactory/build-profile.json`.
- With the `aifactory-code` plugin installed: use its `copilot-agent` skill, and run
  `/aifactory-code:check` before you hand over.
- The tool list is pinned: change `appPackage/mcp-tools.json` from the server's `tools/list`, then
  `node scripts/sync-tools.mjs`. Never switch to dynamic discovery (`run_for_functions: ["*"]`).
- Features bigger than a small change: `/aifactory-code:spec` first, then `/aifactory-code:plan`; the
  specs live in `specs/`. Bugs: `/aifactory-code:fix` (a failing test before the fix).
- Before you write or change code, run the gate in `GUARD.md`: scope, stop and ask, one line per
  trust boundary with a refusal test, then the smallest change. End each answer with what you
  skipped or did not check.
- Never write `env/.env.*.user` or secrets. `atk provision` and `atk publish` are run by a person.
