---
description: Write a feature spec (user stories, requirements, data and zone, success criteria) in specs/NNN-slug/spec.md before any code.
argument-hint: "<what the feature should do>"
---

Read the installed plugin's [`skills/feature-specs/SKILL.md`](../skills/feature-specs/SKILL.md)
and [`reference/spec.md`](../skills/feature-specs/reference/spec.md) before acting.

Write a spec for: $ARGUMENTS

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/feature.mjs" new --title "<short title>" --input "<the request>"`
in the project root, then fill the spec: what and why only, never how. Mark what you would have
to guess with `[NEEDS CLARIFICATION: …]` (at most three) and raise every stop-and-ask item from
"Data and zone" with the person now. Ask the open questions in one message, write the answers in,
and end by showing the suggested branch and the next step (`/aifactory-code:plan <number>`).
Write no code.
