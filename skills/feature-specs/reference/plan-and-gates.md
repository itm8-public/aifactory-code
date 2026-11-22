# The plan and the AI Factory gates

`feature.mjs plan <number>` refuses while the spec has an open `[NEEDS CLARIFICATION]` marker.
Otherwise it writes `plan.md` (technical context pre-filled from the build profile, the gates
table, design, structure, complexity tracking) and `tasks.md`.

## Order

1. **Summary** from the spec.
2. **Technical context**: keep the pre-filled lines and change only what the feature changes.
   Fill "This feature adds".
3. **Gates, first pass**: fill each gate before designing. A FAIL or ASK stops the design until
   the person decides; say so. For G7, write a boundary line for every entry the spec implies
   (pages, routes, tools, uploads, model answers, calls out).
4. **Design**: only what the tasks need. Data model changes (new tables need a migration and,
   for changes people make, an audit row), routes or MCP tools with their inputs, pages, settings.
   Use the skill for the part: `web-app`, `foundry-agent`, `mcp-server`, `copilot-agent`,
   `itm8-design`. Larger pieces go in `research.md`, `data-model.md` or `contracts/` next to
   the plan.
5. **Gates, second pass**: re-check every gate against the design and update the notes. G7 now
   names the real routes, tools and roles.
6. **Project structure**: the real files the feature touches.
7. **Complexity tracking**: only for a FAIL or ASK the person decided to go ahead with: why, and
   the simpler option rejected.
8. Ask a person to review the gates and sign them off. Wait.

## The gates

| Gate | PASS when | FAIL or ASK when |
|---|---|---|
| G1 Data and zone | The data fits the zone in `AGENTS.md`; synthetic data in tests and seeds | Personal data while the zone is not Red (FAIL: stop); zone unknown for new data (ASK) |
| G2 Stop and ask | No stop-and-ask item, or each one answered by a person (name them) | An item is open |
| G3 Ask itm8 | Fits one `web` container with PostgreSQL | Needs a second app, scheduled work, file storage, an extension, more than 30 seconds per request |
| G4 Build rules | Name the AF rules it touches and how it keeps them (for example AF-17: the migration runs as the separate command) | It needs a waiver; only a person adds one |
| G5 AI | No AI, or Azure AI Foundry with the managed identity, actions proposed and approved, evaluation set updated for new behaviour | Another AI provider, or an action that runs without approval (FAIL) |
| G6 Smallest change | The first rung of the ladder in `GUARD.md` step 4 that fully works: nothing nobody asked for, reuse before new code, each new dependency has a reason in the note; no infrastructure code | A new framework, service or container without need; a change made smaller by cutting a control (FAIL) |
| G7 Security | Every trust boundary the feature adds or touches has its line (`GUARD.md` step 3), the classes that fit are checked, and each line has a refusal test task | A line with no control, or a control the design would weaken (FAIL); a boundary that needs a person's call, such as a new outside host or a model answer that acts (ASK) |

N/A only when the gate cannot apply (G5 for a feature without AI). G7 is never N/A: a feature that
touches no boundary is a PASS with the note "No boundary". The result column holds the
word only: `PASS`, `FAIL`, `N/A` or `ASK`.

## Sign-off

The last line of the gates section is `Gates signed off by: <name>, <YYYY-MM-DD>`. The person who
reviewed the table writes it. Never fill it in yourself, even when asked to "just sign it":
offer to wait while they do. Build-check rule AF-30 warns until it is signed.
