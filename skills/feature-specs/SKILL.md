---
name: feature-specs
description: Spec-first flow for features and bugs in an itm8 AI Factory project - specs/NNN-slug/spec.md (user stories, requirements, data and zone, success criteria, [NEEDS CLARIFICATION] markers), plan.md with the AI Factory gates a person signs off, tasks.md with tests first, and bug reports that start with a failing test. Use when someone describes a new feature, screen, integration or agent capability bigger than a small change, asks to plan or break down work, asks for a spec, or reports a bug, in a repository with .aifactory/build-profile.json or a specs/ folder. Adapted from GitHub Spec Kit.
---

# Feature specs: spec, plan, tasks, fix

A light spec-first flow so features are agreed before code and bugs are proven before fixes.
It is optional: a small change (a label, a style, a one-file fix) needs no spec. Suggest it when
a request adds a screen, a table, an integration, an AI capability, or anything with more than one
user story.

Files live in the project: `specs/NNN-slug/spec.md`, `plan.md`, `tasks.md`, and
`specs/bugs/BNNN-slug/report.md`. The names match GitHub Spec Kit, so teams can move between the
two. The script creates files from the plugin's templates and keeps the build profile in step:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/feature.mjs" new --title "<short title>" --input "<the person's words>"
node "${CLAUDE_PLUGIN_ROOT}/scripts/feature.mjs" plan <number>
node "${CLAUDE_PLUGIN_ROOT}/scripts/feature.mjs" bug --title "<short title>"
node "${CLAUDE_PLUGIN_ROOT}/scripts/feature.mjs" list
node "${CLAUDE_PLUGIN_ROOT}/scripts/feature.mjs" sync
```

Run them from the project root (or pass `--dest <project>`). They create nothing in git; they
print a suggested branch name. Use the person's branch conventions.

## Rules

1. **The spec says what and why, never how.** No frameworks, tables, routes or file names in
   `spec.md`. A person who does not code must be able to review it.
2. **Mark, don't guess.** Where the request is silent and the answer changes scope, data, users
   or security, write `[NEEDS CLARIFICATION: <question>]`, at most three, and ask the person.
   Fill other gaps with a reasonable default listed under "Assumptions".
3. **Stop-and-ask surfaces in the spec.** Fill "Data and zone" from the request and `AGENTS.md`.
   Anything on the stop-and-ask list (personal data, AI deciding about people, actions in other
   systems, a new outside service, real customer data) is raised with the person then, not
   discovered during the build.
4. **No plan with open questions.** `feature.mjs plan` refuses while the spec has a marker. Ask
   the questions; when the person cannot answer, they may accept an assumption, which you write
   under "Assumptions" with their name.
5. **Claude fills the gates; a person signs them.** Fill every gate in `plan.md` (PASS, FAIL, N/A
   or ASK, with a note for FAIL and ASK), re-check them after the design, then ask a person to
   review and write the line `Gates signed off by: <name>, <YYYY-MM-DD>`. Never write that line
   yourself, never with the person's name on their behalf. Do not start the build tasks before
   it is signed.
6. **Tests first.** Each story's test tasks come before its code tasks, and the test fails before
   the code makes it pass. The last task runs the build check.
7. **Keep the profile in step.** After you tick tasks or change a spec's status, run
   `feature.mjs sync`. Build-check rule AF-30 warns about open markers after planning, unfilled or
   unsigned gates, and a stale profile.

## Route

| Step | Read | Command |
|---|---|---|
| Write a spec | [reference/spec.md](reference/spec.md) | `/aifactory-code:spec` |
| Plan, gates and tasks | [reference/plan-and-gates.md](reference/plan-and-gates.md), [reference/tasks.md](reference/tasks.md) | `/aifactory-code:plan` |
| Build from the tasks | `tasks.md` in order; the `web-app`, `foundry-agent`, `mcp-server` or `copilot-agent` skill for the code | |
| Fix a bug | [reference/bug-fix.md](reference/bug-fix.md) | `/aifactory-code:fix` |

## Spec Kit

Teams that already use GitHub Spec Kit (`specify`, 1.2.5 or later) keep it and add the itm8 AI
Factory preset instead of these commands. Its constitution points to `AGENTS.md`, its plan
template carries the same gates, and AF-30 reads the same folders. In the Spec Kit project:

```
specify preset add constitution-sync
specify preset add --dev "${CLAUDE_PLUGIN_ROOT}/presets/speckit-aifactory"
```

Details, including when to leave out `constitution-sync`:
[presets/speckit-aifactory/README.md](../../presets/speckit-aifactory/README.md).
