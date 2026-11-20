# [PROJECT_NAME] Constitution

<!-- itm8 AI Factory preset (aifactory-code plugin). Add project principles only when they are
stricter than AGENTS.md; never one that conflicts with it. -->

This project is built for the itm8 AI Factory. **`AGENTS.md`, the AI Factory build rules pinned
by the aifactory-code plugin, is this project's constitution.** It wins over this file and over
every spec, plan and task. Read it before each spec, plan and implementation, together with
`GUARD.md`, the change gate every change passes before code is written.

## Core principles

### I. Platform shape

One `web` container: port 8080, `/healthz`, a non-root user, Easy Auth sign-in with Entra ID,
PostgreSQL with an Entra token, migrations as a separate command, settings from environment
variables. No infrastructure or deployment code in the repository: itm8's Wizard creates it.

### II. Data and zone first (gate G1)

Every spec states the data it stores or shows. Personal data means the Red zone, which only a
person at itm8 confirms; until then the project uses synthetic data only. No real customer data
in prompts, seeds, tests or screenshots.

### III. Stop and ask (gate G2)

Sector rules, AI that decides about people, actions in other systems, a new outside service or
data processor, and work on a customer's code without recorded consent are raised with a person
before planning, never built around.

### IV. Ask itm8 before working around the platform (gate G3)

A second app, scheduled work, file storage, a PostgreSQL extension or requests over 30 seconds
are "ask itm8" items, recorded in `.aifactory/build-profile.json`.

### V. Build rules kept, never waived silently (gate G4)

The plan names the build-check rules (AF-xx) a feature touches. Only a person adds a waiver, with
a reason and an end date.

### VI. AI through Azure AI Foundry, people approve actions (gate G5)

AI calls go to Azure AI Foundry with the managed identity. Actions that send, pay, write or
delete are proposals a person approves in the app. Agent behaviour has an evaluation set.

### VII. Smallest change, never by cutting a control (gate G6)

Take the first rung of the ladder in `GUARD.md` that fully works: skip what nobody asked for,
reuse what exists, then the platform, then an installed dependency. Every new dependency has a
reason. No new framework, service or container without need. A change made smaller by dropping
a validation, a permission check or a test is not smaller.

### VIII. Every trust boundary has a line and a refusal test (gate G7)

Each page, route, tool, upload, model answer or outside call a feature adds or touches gets one
line: who sends what where, which control decides, what must never happen. Each line has a test
that tries to cross it and is refused. A model's answer is untrusted input.

### IX. Tests first

Tests are written first and fail before the code that makes them pass. Bugs are reproduced by a
failing test before they are fixed.

## Governance

- The Constitution Check in every plan is the AI Factory gates table (G1 to G7). Claude fills
  it; a person reviews it and writes `Gates signed off by: <name>, <YYYY-MM-DD>`. Implementation
  starts only after that line is there.
- Changes to the build rules happen upstream in the itm8 build kit and reach this project
  through the aifactory-code plugin (`/aifactory-code:update-rules`), not in this file.

**Version**: [CONSTITUTION_VERSION] | **Ratified**: [RATIFICATION_DATE] | **Last Amended**: [LAST_AMENDED_DATE]
