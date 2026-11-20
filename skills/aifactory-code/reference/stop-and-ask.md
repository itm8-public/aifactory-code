# Stop and ask

Stop, say what you found, and wait for a person when any of these appear. Do not build around
them, and do not decide them yourself.

## A person at itm8 decides

| Trigger | Why | What happens next |
|---|---|---|
| Personal data: names, e-mail addresses, phone numbers, personal identity numbers, addresses, employee data | Personal data means the Red zone (AI Factory policy). Yellow allows no personal data | itm8 confirms the zone. Until then, synthetic data only |
| Health, biometric, religion, trade-union or children's data; sector rules (NIS2, DORA, finance, public sector) | Special-category or regulated data: Red plus a DPIA or sector review | Stop. A DPIA or sector review comes first |
| AI that makes or shapes decisions about people (hiring, credit, grading, scoring) | Possible EU AI Act high-risk use | Stop. Needs a high-risk review and human review of each decision |
| AI that acts in other systems (sends, pays, writes, deletes) | Every action needs human approval in code | Allowed only with an approval step in code, after a person agrees to the design |
| Social scoring, hidden manipulation, biometric identification in public spaces | Prohibited practices (EU AI Act) | Never build these |
| A third-party service that receives the app's data (SaaS APIs, analytics, e-mail, chat) | A new processor and an egress host | Ask. In Red, every outside host must be on the firewall allow-list |
| Real customer data in a prompt, seed file, test or screenshot | Data protection; draft AI processing policy | Replace with synthetic data |
| Working on a customer's code or data with Claude Code | Claude Code is an AI processor of what it reads (itm8's AI processing policy) | Only with the customer's recorded consent; otherwise synthetic data and itm8-owned code |

## Ask itm8: the platform does not support it for every app yet

| Need | Today | Planned fix |
|---|---|---|
| A second app (`api` or `worker`) | Only `web` gets Easy Auth; nothing lets `api` prove a call came from `web` | Planned — ask itm8 |
| Scheduled work | A worker never starts on Basic; a timer runs once per replica on higher levels. Write it as a run-once command with a database lock | Planned — ask itm8 |
| File storage | No storage account for apps | Not planned yet |
| A PostgreSQL extension | None is allow-listed. Use `gen_random_uuid()` for ids | Not planned yet |
| Requests over 30 seconds, streaming | The gateway cancels after 30 s; streaming is untested | Start the work, answer at once, let the browser poll |
| A Copilot agent with actions that change data, or with SharePoint or connector knowledge holding customer or personal data | The templates are read-only, knowledge-free | Ask itm8 |
| A Foundry hosted or prompt agent | Not templated; cannot reach private services | Ask itm8 (agent platform account) |
| An MCP tool or agent action that writes without a person approving | Never: actions are proposals a person approves | Not planned |

Record each open item in `.aifactory/build-profile.json` under `askItm8`, with who was asked.
