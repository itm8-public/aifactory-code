"""The agent's tools: a fixed list in code, built per request for the signed-in user.

Two kinds:
- read: the model may call it; the result goes back to the model.
- action: the model can only PROPOSE it. The proposal waits in agent_actions until the user
  approves it in the app; then ACTIONS[...].execute runs, in a transaction with an audit row.
A prompt instruction is never the control. Replace the examples with the solution's own tools.
"""

import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Annotated, Any

from psycopg import AsyncConnection
from psycopg.types.json import Jsonb
from psycopg_pool import AsyncConnectionPool

from .auth import User


@dataclass
class Turn:
    """What happened in one agent turn, for the response and the evaluation."""

    tools_used: list[str]
    proposals: list[dict[str, Any]]


@dataclass(frozen=True)
class Action:
    summary: Callable[[dict[str, Any]], str]
    validate: Callable[[dict[str, Any]], dict[str, Any]]
    execute: Callable[[AsyncConnection, User, dict[str, Any]], Awaitable[None]]


def _title(args: dict[str, Any]) -> dict[str, Any]:
    title = str(args.get("title", "")).strip()
    if not 1 <= len(title) <= 200:
        raise ValueError("title must be 1 to 200 characters")
    return {"title": title}


async def _create_item(conn: AsyncConnection, user: User, args: dict[str, Any]) -> None:
    row = await (
        await conn.execute(
            "insert into items (title, created_by) values (%s, %s) returning id", (args["title"], user.id)
        )
    ).fetchone()
    await audit(conn, user.id, "create", "item", str(row[0]), {"fields": ["title"], "via": "agent-approved"})


ACTIONS: dict[str, Action] = {
    "create_item": Action(
        summary=lambda a: f'Create the item "{a["title"]}"', validate=_title, execute=_create_item
    ),
}


async def audit(
    conn: AsyncConnection, actor: str, action: str, entity: str, entity_id: str, detail: dict | None = None
) -> None:
    """One audit row, in the caller's transaction. Ids and field names only, never personal data."""
    await conn.execute(
        "insert into audit_log (actor_id, action, entity, entity_id, detail) values (%s, %s, %s, %s, %s)",
        (actor, action, entity, entity_id, Jsonb(detail) if detail is not None else None),
    )


def build_tools(pool: AsyncConnectionPool, user: User, turn: Turn) -> list[Callable[..., Awaitable[str]]]:
    """Plain async functions; app/agent.py hands them to Agent Framework."""

    async def search_items(
        query: Annotated[str, "Words to look for in the item title."],
        limit: Annotated[int, "Most items to return, 1 to 20."] = 10,
    ) -> str:
        """Find items whose title contains the query, newest first."""
        turn.tools_used.append("search_items")
        query = str(query).strip()[:200]
        limit = max(1, min(int(limit), 20))
        like = "%" + query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        async with pool.connection() as conn:
            rows = await (
                await conn.execute(
                    "select id, title from items where title ilike %s order by created_at desc limit %s",
                    (like, limit),
                )
            ).fetchall()
        return json.dumps({"result": [{"id": str(r[0]), "title": r[1]} for r in rows]})

    async def create_item(title: Annotated[str, "Title of the new item."]) -> str:
        """Propose a new item. A person must approve it in the app before it is created."""
        turn.tools_used.append("create_item")
        action = ACTIONS["create_item"]
        try:
            args = action.validate({"title": title})
        except ValueError as err:
            return json.dumps({"error": str(err)})
        async with pool.connection() as conn:
            row = await (
                await conn.execute(
                    "insert into agent_actions (user_id, tool, arguments, summary) values (%s, %s, %s, %s)"
                    " returning id, created_at",
                    (user.id, "create_item", Jsonb(args), action.summary(args)),
                )
            ).fetchone()
        proposal = {
            "id": str(row[0]),
            "tool": "create_item",
            "summary": action.summary(args),
            "status": "pending",
            "createdAt": row[1].isoformat(),
        }
        turn.proposals.append(proposal)
        return json.dumps(
            {
                "proposed": True,
                "actionId": proposal["id"],
                "note": "Nothing has changed yet. The user must approve it.",
            }
        )

    return [search_items, create_item]
