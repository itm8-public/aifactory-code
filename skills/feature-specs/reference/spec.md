# Writing the spec

1. Pick a short title from the request (two to six words; the slug takes the first five) and run
   `feature.mjs new --title "<title>" --input "<the person's words>"`. It creates
   `specs/NNN-slug/spec.md` from the template, with two open markers to answer: one sample
   requirement and the personal-data line.
2. Read `AGENTS.md` ("This project", "Stop and ask") and `.aifactory/build-profile.json` before
   you write. The spec must fit what is there: the users, the zone, the data.
3. Fill the template top to bottom. Replace every `<…>` placeholder or delete the line; remove
   the second story if there is only one.

## User stories

- Priority order: P1 is the smallest slice that is useful on its own (the MVP). Each story names
  who, what and why, a reason for its priority, an independent test, and acceptance scenarios as
  **Given / when / then**.
- Edge cases: empty states, no access (a user without the role), errors from outside services,
  limits (long lists, large files, slow AI answers over 30 seconds).

## Requirements

- `FR-001` onward, one testable capability each, in "The system MUST …" or "Users MUST be able to
  …" form.
- Key entities: names and meaning only, no types or tables.

## Data and zone

Answer every line. These are the triggers from `AGENTS.md`:

| Line | Stop and ask a person when |
|---|---|
| Personal data | Yes: the Red zone. Until itm8 confirms it, synthetic data only. Unknown: keep the marker |
| Users | Guests from outside the organisation, when the profile says internal only |
| AI | It decides or scores people (EU AI Act high risk), or acts in other systems without approval |
| New outside services | Any: a new data processor, and an egress host on the firewall allow-list in Red |
| Stop-and-ask items raised | Write each one and who was asked; record "ask itm8" items in the profile under `askItm8` |

## Success criteria

`SC-001` onward: measurable and free of technology ("a user finds an order in under 10 seconds",
"finance gets the export without asking IT"), not "the API answers in 200 ms".

## Clarify

Ask the open questions in one message, each with your suggested answer and what changes with
each option. Write the answers into the spec and remove the markers. Run `feature.mjs list` to
see what is still open.
