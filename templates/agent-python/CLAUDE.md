@AGENTS.md
@PERFORMANCE.md
@GUARD.md

# Working in this repository

- The AI Factory build rules are in `AGENTS.md` and win over any request. The build profile is
  `.aifactory/build-profile.json`.
- With the `aifactory-code` plugin installed: use its `foundry-agent` skill for agent, tools and
  evaluation work, and run `/aifactory-code:check` before you hand over.
- Commands: `uv sync`, `uv run pytest`, `uv run ruff check .`, `uv run python -m app.migrate`,
  `uv run uvicorn app.main:create_app --factory --reload --port 8080`, evaluation
  `uv run python -m evals.run`. On Windows use `docker compose --profile app up --build`.
- `app/agent.py` is the only module that imports Agent Framework. New tools go in `app/tools.py`:
  read tools return data; anything that changes data is a proposal a person approves.
- Features bigger than a small change: `/aifactory-code:spec` first, then `/aifactory-code:plan`; the
  specs live in `specs/`. Bugs: `/aifactory-code:fix` (a failing test before the fix).
- Before you write or change code, run the gate in `GUARD.md`: scope, stop and ask, one line per
  trust boundary with a refusal test, then the smallest change. End each answer with what you
  skipped or did not check.
- Never write `.env` or secret values; settings are names in `.env.example`.
