---
description: Update this project's AGENTS.md, PERFORMANCE.md and GUARD.md to the build rules pinned in the installed plugin, keeping the "This project" block.
---

1. Read the first line of the project's `AGENTS.md`: `<!-- aifactory-code x.y.z · build-kit v @ sha -->`.
   Compare it with `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json` and
   `${CLAUDE_PLUGIN_ROOT}/rules/pin.json`. If they match, say it is current and stop.
2. Show the person what changed between the two rule versions (a short summary, not the whole
   diff) and ask before writing.
3. Write the new `AGENTS.md`: the header line with the new versions, then the pinned
   `${CLAUDE_PLUGIN_ROOT}/rules/build-kit/AGENTS.md` with its `## This project` section replaced by
   the project's current one, unchanged.
4. Copy `${CLAUDE_PLUGIN_ROOT}/rules/build-kit/PERFORMANCE.md` and `GUARD.md` to the project root
   unchanged. If `CLAUDE.md` does not import them, add `@PERFORMANCE.md` and `@GUARD.md` under
   `@AGENTS.md`.
5. Update `kit` and `generator` in `.aifactory/build-profile.json`, then run the build check.
