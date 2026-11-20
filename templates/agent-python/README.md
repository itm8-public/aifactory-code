# __TITLE__

An AI agent built for the itm8 AI Factory with the `aifactory-code` plugin (__PLUGIN_VERSION__,
build rules __KIT_VERSION__): Microsoft Agent Framework (Python) on Azure AI Foundry, in one
container with a small chat page. Follow `AGENTS.md`; `.aifactory/build-profile.json` records the
design.

## How it works

- The browser keeps the conversation and sends it to `POST /api/chat`; the server stores no chat
  history, so any replica can answer.
- The agent's tools are a fixed list in `app/tools.py`. **Read** tools return data to the model.
  **Action** tools only *propose*: the proposal waits in `agent_actions` until the signed-in user
  approves it on the page; then the server, not the model, runs it in one transaction with an
  audit row.
- Models come from Azure AI Foundry with the app's managed identity. Content-filter results and
  429s are normal answers. Prompts and answers are never logged.

## Run it locally

Needs Python 3.13, [uv](https://docs.astral.sh/uv/) and Docker.

```bash
cp .env.example .env
uv sync
docker compose up -d --wait
uv run python -m app.migrate
uv run uvicorn app.main:create_app --factory --reload --port 8080
```

Open http://localhost:8080. Locally a stand-in user replaces Easy Auth (`DEV_AUTH_BYPASS=true` in
`.env`); the app refuses that setting in Azure. For answers from a model, set
`AZURE_AI_PROJECT_ENDPOINT` and `AI_CHAT_DEPLOYMENT` in `.env` and sign in with `az login`.

On Windows, or to run everything in containers:

```bash
docker compose --profile app up --build
docker compose run --rm app python -m app.migrate
```

| Command | What it does |
|---|---|
| `uv run pytest` | Tests against the local `app_test` database |
| `uv run ruff check .` / `uv run ruff format .` | Lint and format |
| `uv run python -m app.migrate` | Applies `migrations/*.sql` |
| `uv run python -m evals.run` | Runs the evaluation set (`evals/agent.json`) against Foundry |
| `uv run pip-audit` | Dependency audit |

## The app

| Item | Value |
|---|---|
| App | `__APP__`, kind `web`: one container serves the chat page and `/api` |
| Port | 8080 |
| Health path | `/healthz` (no sign-in, no database); `/readyz` also checks the database |
| Sign-in | Easy Auth in front of the app; the server reads `X-MS-CLIENT-PRINCIPAL` |
| Database | PostgreSQL, Entra token auth, data access only |
| Migrate command | `python -m app.migrate` (same image, run as the migration job) |
| AI | Azure AI Foundry, deployment from `AI_CHAT_DEPLOYMENT` |

### Settings

All names are in `.env.example`. The platform sets `APP_ENVIRONMENT`, `AZURE_CLIENT_ID`, the
`PG*` names, `DB_RUNTIME_ROLES` (migration job) and, in a customer landing zone, the Foundry
endpoint.

| Setting | Kind | Purpose |
|---|---|---|
| `LOG_LEVEL` | plain | Log level, default `info` |
| `APP_PUBLIC_ORIGIN` | plain, optional | Public origin for the cross-site guard |
| `AI_CHAT_DEPLOYMENT` | plain | Model deployment name |
| `AI_REQUESTS_PER_USER_PER_HOUR` | plain, optional | Per-user AI limit, default 30 |

### Roles

| Entra app role | May |
|---|---|
| (any signed-in user) | Chat with the agent, approve or reject what it proposed for them |
| `App.Admin` | Everything |

### Outside services

None. List every outside host the agent calls here (it is needed for the Red zone allow-list).

## Hand-over values

For the Management app Wizard (customer landing zone) or the platform team (itm8's shared
platform):

| Field | Value |
|---|---|
| App, kind | `__APP__`, `web` |
| Image repository | `<solution>/__APP__` |
| Port, health path | 8080, `/healthz` |
| Easy Auth | On |
| Database | Yes |
| Migration job | Repository `<solution>/__APP__`, command `python -m app.migrate` |
| AI | Yes |
| Settings, roles | As above |
