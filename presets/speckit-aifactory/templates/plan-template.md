<!-- itm8 AI Factory preset (aifactory-code plugin). Generated from templates/specs: do not edit here. -->
<!-- These gates are the Constitution Check for an AI Factory project. -->

## AI Factory gates

<!--
  Claude fills Result (PASS, FAIL, N/A or ASK) and Note from the spec, AGENTS.md, GUARD.md and
  .aifactory/build-profile.json, before the design and again after it. FAIL and ASK need a note
  that says what happens next. A person reviews the table and writes the sign-off line; Claude
  never signs.
-->

| Gate | Question | Result | Note |
|---|---|---|---|
| G1 Data and zone | Does the feature fit the zone in AGENTS.md? Personal data means Red: stop | | |
| G2 Stop and ask | Is any stop-and-ask item raised: sector rules, AI deciding about people, actions in other systems, a new data processor, real customer data? | | |
| G3 Ask itm8 | Does it need what the platform lacks: a second app (B13), scheduled work (B12), file storage, a PostgreSQL extension, requests over 30 seconds? | | |
| G4 Build rules | Which AF rules does it touch, and how does it keep them? | | |
| G5 AI | Azure AI Foundry with the managed identity only; actions proposed and approved by a person; evaluation set updated | | |
| G6 Smallest change | The first rung that fully works (GUARD.md step 4): skip what nobody asked for, reuse the codebase, then the platform, then an installed dependency; no new dependency without a reason; no infrastructure code; never by cutting a control | | |
| G7 Security | One line per trust boundary (GUARD.md step 3): who sends what where, which control decides, what must never happen; each with a refusal test in tasks.md. No boundary: say so | | |

Gates signed off by: <name>, <YYYY-MM-DD>
