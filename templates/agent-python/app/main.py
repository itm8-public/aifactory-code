"""The web container: FastAPI on port 8080 behind Easy Auth.

Run with `uvicorn app.main:create_app --factory --host 0.0.0.0 --port 8080`. Serves the chat page
and /api from one origin; /healthz answers without sign-in or database.
"""

import json
import logging
import re
import time
import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from psycopg_pool import AsyncConnectionPool
from pydantic import BaseModel, Field

from .agent import Runner, create_runner
from .auth import User, dev_user, parse_principal
from .db import create_pool
from .settings import Settings, load_settings
from .tools import ACTIONS, Turn, audit, build_tools

STATIC = Path(__file__).resolve().parent / "static"
REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{8,128}$")
UNSAFE = {"POST", "PUT", "PATCH", "DELETE"}
CSP = "; ".join(
    [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
    ]
)
HEADERS = {
    "content-security-policy": CSP,
    "strict-transport-security": "max-age=31536000; includeSubDomains",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "cross-origin-opener-policy": "same-origin",
}

log = logging.getLogger("app")


class JsonFormatter(logging.Formatter):
    """Structured JSON to stdout, one event per line. Never log prompts, answers or tokens."""

    def format(self, record: logging.LogRecord) -> str:
        event = {"level": record.levelname.lower(), "msg": record.getMessage(), "logger": record.name}
        for key in ("request_id", "method", "path", "status", "duration_ms"):
            if hasattr(record, key):
                event[key] = getattr(record, key)
        if record.exc_info:
            event["error"] = record.exc_info[0].__name__ if record.exc_info[0] else "error"
        return json.dumps(event)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatInput(BaseModel):
    """The conversation so far, kept by the browser: the server stores no chat history."""

    messages: list[ChatMessage] = Field(min_length=1, max_length=20)


class Decision(BaseModel):
    approve: bool


def _error(status: int, message: str, request: Request) -> JSONResponse:
    return JSONResponse({"error": message, "requestId": request.state.request_id}, status_code=status)


def _allowed_origins(request: Request, s: Settings) -> set[str]:
    if s.public_origin:
        return {s.public_origin.rstrip("/")}
    host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    if not host:
        return set()
    return {f"https://{host}"} | (set() if s.in_azure else {f"http://{host}"})


def _action_dto(row) -> dict:
    return {
        "id": str(row[0]),
        "tool": row[1],
        "summary": row[2],
        "status": row[3],
        "createdAt": row[4].isoformat(),
    }


def create_app(
    settings: Settings | None = None, runner: Runner | None = None, pool: AsyncConnectionPool | None = None
) -> FastAPI:
    s = settings or load_settings()
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    logging.basicConfig(level=s.log_level.upper(), handlers=[handler], force=True)
    db = pool or create_pool(s)
    run = runner or create_runner(s)
    if s.dev_auth_bypass:
        log.warning("DEV_AUTH_BYPASS is on: every API request acts as a local stand-in user")

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        await db.open()
        yield
        await db.close()

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

    @app.middleware("http")
    async def guard(request: Request, call_next):
        given = request.headers.get("x-request-id", "")
        request.state.request_id = given if REQUEST_ID.match(given) else str(uuid.uuid4())
        path = request.url.path
        protected = path.startswith("/api/")
        if protected and request.method in UNSAFE:
            origin = request.headers.get("origin")
            local = (
                not s.in_azure and origin and re.match(r"^http://(localhost|127\.0\.0\.1)(:\d+)?$", origin)
            )
            if origin and not local and origin not in _allowed_origins(request, s):
                response = _error(403, "This request came from another site.", request)
            elif not origin and not request.headers.get("content-type", "").startswith("application/json"):
                response = _error(415, "Send JSON.", request)
            else:
                response = None
            if response is not None:
                response.headers.update(HEADERS)
                return response
        request.state.user = None
        if protected:
            user = parse_principal(
                request.headers.get("x-ms-client-principal"), request.headers.get("x-ms-client-principal-id")
            ) or (dev_user(s.dev_auth_roles) if s.dev_auth_bypass else None)
            if user is None:
                response = _error(401, "Your sign-in has expired. Reload the page.", request)
                response.headers.update(HEADERS)
                return response
            request.state.user = user
        started = time.monotonic()
        try:
            response = await call_next(request)
        except Exception:
            log.exception("request failed", extra={"request_id": request.state.request_id, "path": path})
            response = _error(
                500, "Something went wrong. Try again, and give support the request id.", request
            )
        response.headers.update(HEADERS)
        response.headers["x-request-id"] = request.state.request_id
        if path != "/healthz":
            log.info(
                "request",
                extra={
                    "request_id": request.state.request_id,
                    "method": request.method,
                    "path": path,
                    "status": response.status_code,
                    "duration_ms": round((time.monotonic() - started) * 1000),
                },
            )
        return response

    @app.exception_handler(RequestValidationError)
    async def invalid(request: Request, err: RequestValidationError) -> JSONResponse:
        # Name the fields, never echo the values.
        fields = sorted({".".join(str(p) for p in e["loc"] if p != "body") or "body" for e in err.errors()})
        return _error(400, f"Check these fields: {', '.join(fields)}.", request)

    def user_of(request: Request) -> User:
        return request.state.user

    @app.get("/healthz")
    async def healthz() -> dict:
        return {"status": "ok"}

    @app.get("/readyz")
    async def readyz(request: Request):
        try:
            async with db.connection() as conn:
                await conn.execute("select 1")
            return {"status": "ok"}
        except Exception:
            log.warning("readiness check: database unavailable")
            return _error(503, "unavailable", request)

    @app.get("/api/me")
    async def me(request: Request) -> dict:
        u = user_of(request)
        return {"id": u.id, "name": u.name, "roles": list(u.roles)}

    @app.post("/api/chat")
    async def chat(request: Request, body: ChatInput) -> dict:
        u = user_of(request)
        async with db.connection() as conn:
            row = await (
                await conn.execute(
                    "select count(*) from ai_usage where user_id = %s and at > %s",
                    (u.id, datetime.now(UTC) - timedelta(hours=1)),
                )
            ).fetchone()
            if row[0] >= s.ai_requests_per_hour:
                return {"status": "try-later", "reason": "limit", "retryAfterSeconds": 15 * 60}
            await conn.execute("insert into ai_usage (user_id) values (%s)", (u.id,))
        turn = Turn(tools_used=[], proposals=[])
        outcome = await run([m.model_dump() for m in body.messages], build_tools(db, u, turn))
        if outcome.kind == "answer":
            return {
                "status": "answered",
                "answer": outcome.text,
                "proposals": turn.proposals,
                "toolsUsed": turn.tools_used,
            }
        if outcome.kind == "content-filter":
            return {"status": "blocked", "reason": "content-filter"}
        if outcome.kind == "busy":
            return {"status": "try-later", "reason": "busy", "retryAfterSeconds": outcome.retry_after_seconds}
        return {"status": "not-configured"}

    @app.get("/api/actions")
    async def actions(request: Request) -> list[dict]:
        u = user_of(request)
        async with db.connection() as conn:
            rows = await (
                await conn.execute(
                    "select id, tool, summary, status, created_at from agent_actions"
                    " where user_id = %s and status = 'pending' order by created_at desc limit 50",
                    (u.id,),
                )
            ).fetchall()
        return [_action_dto(r) for r in rows]

    # The human in the loop: only the user the agent worked for decides, and only then does the
    # server run the action, in one transaction with its audit row.
    @app.post("/api/actions/{action_id}/decision")
    async def decide(request: Request, action_id: str, body: Decision):
        u = user_of(request)
        try:
            uuid.UUID(action_id)
        except ValueError:
            return _error(404, "The proposed action was not found.", request)
        async with db.connection() as conn, conn.transaction():
            row = await (
                await conn.execute(
                    "select id, tool, arguments, status from agent_actions"
                    " where id = %s and user_id = %s for update",
                    (action_id, u.id),
                )
            ).fetchone()
            if row is None:
                return _error(404, "The proposed action was not found.", request)
            if row[3] != "pending":
                return _error(409, "This action has already been decided.", request)
            action = ACTIONS.get(row[1])
            if body.approve and action is not None:
                await action.execute(conn, u, action.validate(row[2]))
                status = "approved"
            else:
                status = "rejected" if not body.approve else "failed"
            updated = await (
                await conn.execute(
                    "update agent_actions set status = %s, decided_at = now() where id = %s"
                    " returning id, tool, summary, status, created_at",
                    (status, action_id),
                )
            ).fetchone()
            await audit(conn, u.id, f"agent-action-{status}", "agent-action", action_id, {"tool": row[1]})
        return _action_dto(updated)

    app.mount("/", StaticFiles(directory=STATIC, html=True), name="static")
    return app
