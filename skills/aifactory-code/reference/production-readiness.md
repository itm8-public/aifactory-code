# Production readiness and governance

Before a change ships to production, itm8's governance applies **proportional to the solution's
zone** (`.aifactory/build-profile.json`). Build to Yellow until itm8 confirms the zone.

- **Green** (internal users, no personal data): the **free automated checks only**. Keep the build
  check clean and the CI checks green. Add no owner sign-off and no extra gate — Green stays fast.
- **Yellow** (external users or business data, still no personal data) and **Red** (personal data,
  after itm8 confirms it): the full list below. These are prompts a person answers, not something
  Claude decides or signs.

> Naming of the gates below is provisional; the canonical order is being set separately and will
> slot in without changing what is checked.

## 1. Production readiness checklist

| Item | Green | Yellow / Red | How |
|---|---|---|---|
| Secrets never in code, logs or prompts | automated | yes | Secret guard and build check AF-10, AF-11, AF-12, AF-33; read values from settings |
| Input and output validation at trust boundaries | automated | yes | A schema per request body and per external response; AF-31 blocks unsafe shapes |
| Dependency hygiene | automated | yes | Committed lock file (AF-22); the CI dependency audit; no unpinned direct dependencies |
| Tests present and passing | automated | yes | `build`, `test`, `lint` scripts (AF-25); a refusal test per trust boundary (GUARD.md) |
| Logging without secrets | automated | yes | Log ids and outcomes, not request bodies, headers or the whole environment (AF-33) |
| Rollback known | — | person | How to undo this change: a reversible migration or a documented back-out, and who runs it |

The automated rows run for every zone, Green included, through the build check and CI. The rollback
item is a person's answer and applies to Yellow and Red.

## 2. Ownership gate (Yellow / Red)

A production change names two owners, recorded with the change (the pull request description or the
build profile):

- a **system owner** — accountable for the running solution; and
- a **business owner** — accountable for the value and the decision to ship.

CODEOWNERS covers review; the two named owners cover accountability. Claude records the names a
person gives and never invents them.

## 3. Security requirements as acceptance criteria (Yellow / Red)

Each security requirement for the change is written as an **acceptance criterion** in the spec
(`specs/NNN-slug/spec.md`) or the pull request, and **verified before ship**:

- one line per trust boundary (who sends what where, which control decides, what must never happen),
  each with a refusal test that passes (GUARD.md step 3, plan gate G7);
- the stop-and-ask items that apply, with their answers;
- for Red: every outside host the app calls, and the data handling the zone requires.

"Verified" means the test ran and passed, not that it exists. Claude reports what it ran.

## 4. The five POC-to-production gates (Yellow / Red, surfaced)

Before a proof of concept becomes a production solution, surface these five and record where each
stands. They are a checklist to raise, not something Claude signs:

1. **Business viability** — a named business owner, a decision to invest, and the value it serves.
2. **Data and security readiness** — the zone confirmed, personal or special data handled to
   policy, trust boundaries with controls and refusal tests.
3. **Technical viability** — it fits the platform (the build check is clean) and the design holds at
   the expected load.
4. **Production readiness** — section 1 above, plus a known rollback and an operational owner.
5. **Value readiness** — how the solution's value is measured after it ships, and who looks.

Record open items in `.aifactory/build-profile.json` (for example under `askItm8`) with who was
asked. A gate that is not met is a stop-and-ask, not a blocker Claude removes.
