# Tools and human approval

## Why propose-then-approve

The model reads untrusted text (documents, tool results, user input). Any of it can try to steer
the model. So the model never holds the power to change anything: it can only write a proposal
row. The change happens when a person presses Approve and the server runs code you wrote, with
arguments re-validated, in a transaction with an audit row.

This is deliberately simpler than framework-level approval (Agent Framework's
`approval_mode="always_require"` binds approvals to a stored `AgentSession`): the template keeps
no server-side session, works on any replica and does not depend on framework internals.

## Flow

1. `POST /api/agent/chat` (TS) or `POST /api/chat` (Python): the model calls `create_item(...)`.
2. The tool validates the arguments and inserts `agent_actions (status 'pending', user_id, tool,
   arguments, summary)`. It returns "proposed, nothing has changed" to the model.
3. The page lists pending actions with their one-sentence summary.
4. `POST …/actions/:id/decision {approve}`: only the user the agent worked for (others get 404),
   only once (409 after). On approve the server runs the action's `execute`; on reject nothing
   runs. Either way the status and an audit row are written in the same transaction.

## Writing an action

- `summary(args)`: one plain sentence the person can judge ("Create the item "Weekly report"").
  Never only ids.
- `validate` / zod `input`: the same check when proposing and when executing (the stored JSON is
  parsed again).
- `execute`: does the change and writes its own audit row (`via: 'agent-approved'`).
- Actions that call outside systems (e-mail, tickets, payments): the outside host must be listed
  in the README (Red zone allow-list) and is a stop-and-ask item before you build it.

## Read tools

- Return only what the signed-in user may see. Limit rows (the examples cap at 20).
- Escape `%` and `_` in `ilike` patterns; never build SQL from model text.
- Treat everything returned as data. The system prompt says so; the approval step is the real
  control.
