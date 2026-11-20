"""Test set-up: the real app and a real PostgreSQL test database, with a scripted model.

Locally: `docker compose up -d --wait` first (it creates app_test). In CI: a postgres service.
External services are injected (the runner), never mocked by module.
"""

import asyncio
import base64
import json
import os

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.agent import Outcome
from app.main import create_app
from app.migrate import run_migrations
from app.settings import load_settings

USER = "11111111-1111-4111-8111-111111111111"
OTHER = "22222222-2222-4222-8222-222222222222"
OBJECT_ID = "http://schemas.microsoft.com/identity/claims/objectidentifier"

ENV = {
    "PGHOST": os.environ.get("PGHOST", "localhost"),
    "PGPORT": os.environ.get("PGPORT", "55432"),
    "PGDATABASE": os.environ.get("PGDATABASE_TEST", "app_test"),
    "PGUSER": os.environ.get("PGUSER", "postgres"),
    "LOG_LEVEL": "warning",
}


def principal(user_id: str, roles: tuple[str, ...] = (), name: str = "Test user") -> dict[str, str]:
    claims = [{"typ": OBJECT_ID, "val": user_id}, {"typ": "name", "val": name}]
    claims += [{"typ": "roles", "val": r} for r in roles]
    raw = json.dumps({"auth_typ": "aad", "name_typ": "name", "role_typ": "roles", "claims": claims})
    return {"x-ms-client-principal": base64.b64encode(raw.encode()).decode()}


class ScriptedModel:
    """Plays the model: calls the given tools by name, then answers."""

    def __init__(self) -> None:
        self.script: list[tuple[str, dict]] = []
        self.answer = "Done."

    async def __call__(self, history, tools):
        by_name = {t.__name__: t for t in tools}
        for name, args in self.script:
            await by_name[name](**args)
        return Outcome("answer", text=self.answer)


@pytest.fixture(scope="session")
def settings():
    s = load_settings(ENV)
    asyncio.run(run_migrations(s, []))
    return s


@pytest.fixture
def model():
    return ScriptedModel()


@pytest.fixture
def client(settings, model):
    with psycopg.connect(
        host=settings.pg_host, port=settings.pg_port, dbname=settings.pg_database, user=settings.pg_user
    ) as conn:
        conn.execute("truncate items, audit_log, ai_usage, agent_actions restart identity")
    with TestClient(create_app(settings, runner=model), base_url="https://app.example") as c:
        yield c
