"""Settings from environment variables, checked once at startup.

Errors name what is wrong, never a value. Unset APP_ENVIRONMENT means local development; in
Azure the platform sets it (dev, test or prod) with AZURE_CLIENT_ID, the PG* names and the
Foundry endpoint. Azure access uses the managed identity: there is no key to configure.
"""

import os
import re
from dataclasses import dataclass, field

# Common secret shapes: a setting that looks like one stops the start (from the Management app).
_SECRET_SHAPES = [
    re.compile(p)
    for p in (
        r"(?i)(?<![A-Za-z0-9])(?:secret|client_?secret|api_?key|access_?key|token|password)\s*[:=]\s*[^\s'\"$(){}]{6,}",
        r"\bgh[pousr]_[A-Za-z0-9]{30,}",
        r"\bAKIA[0-9A-Z]{16}\b",
        r"\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}",
        r"\bsk-(?:ant-api\d+-|proj-|svcacct-)?[A-Za-z0-9_-]{32,}",
        r"\b[A-Za-z0-9~_.-]{3}\dQ~[A-Za-z0-9~_.-]{31,}",
        r"://[^\s/:@]+:[^\s/@]+@",
    )
]

ENVIRONMENTS = ("dev", "test", "prod")


def looks_like_secret(value: str) -> bool:
    return any(p.search(value) for p in _SECRET_SHAPES)


@dataclass(frozen=True)
class Settings:
    app_environment: str | None
    azure_client_id: str | None
    pg_host: str
    pg_port: int
    pg_database: str
    pg_user: str
    db_pool_max: int
    project_endpoint: str | None
    openai_endpoint: str | None
    chat_deployment: str | None
    ai_requests_per_hour: int
    log_level: str
    public_origin: str | None
    dev_auth_bypass: bool
    dev_auth_roles: tuple[str, ...] = field(default_factory=tuple)
    port: int = 8080

    @property
    def in_azure(self) -> bool:
        return self.app_environment is not None


def _int(env: dict[str, str], name: str, default: int, problems: list[str], low: int, high: int) -> int:
    raw = env.get(name, "").strip()
    if not raw:
        return default
    if not raw.isdigit() or not low <= int(raw) <= high:
        problems.append(f"{name}: expected a whole number from {low} to {high}")
        return default
    return int(raw)


def load_settings(env: dict[str, str] | None = None) -> Settings:
    env = dict(os.environ) if env is None else env
    get = lambda name: env.get(name, "").strip() or None  # noqa: E731
    problems: list[str] = []

    for name, value in env.items():
        if name.startswith(("PG", "AZURE_", "AI_", "APP_", "DEV_")) and looks_like_secret(value):
            problems.append(
                f"{name}: looks like a secret value; use the managed identity or a Key Vault reference"
            )

    app_environment = get("APP_ENVIRONMENT")
    if app_environment is not None and app_environment not in ENVIRONMENTS:
        problems.append("APP_ENVIRONMENT: expected dev, test or prod")
    for name in ("PGHOST", "PGDATABASE", "PGUSER"):
        if not get(name):
            problems.append(f"{name}: is required")
    bypass = (get("DEV_AUTH_BYPASS") or "false").lower() in ("true", "1")
    if bypass and app_environment:
        problems.append(
            "DEV_AUTH_BYPASS: is for local development only and must be off when APP_ENVIRONMENT is set"
        )
    if app_environment and not get("AZURE_CLIENT_ID"):
        problems.append("AZURE_CLIENT_ID: is required in Azure")
    for name in ("AZURE_AI_PROJECT_ENDPOINT", "AZURE_OPENAI_ENDPOINT", "APP_PUBLIC_ORIGIN"):
        value = get(name)
        if (
            value
            and not value.startswith("https://")
            and not (name == "APP_PUBLIC_ORIGIN" and not app_environment)
        ):
            problems.append(f"{name}: must be an https URL")
    if app_environment and not (get("AZURE_AI_PROJECT_ENDPOINT") or get("AZURE_OPENAI_ENDPOINT")):
        problems.append("AZURE_AI_PROJECT_ENDPOINT: or AZURE_OPENAI_ENDPOINT is required in Azure")
    if app_environment and not get("AI_CHAT_DEPLOYMENT"):
        problems.append("AI_CHAT_DEPLOYMENT: is required in Azure")
    log_level = (get("LOG_LEVEL") or "info").lower()
    if log_level not in ("debug", "info", "warning", "error"):
        problems.append("LOG_LEVEL: expected debug, info, warning or error")

    settings = Settings(
        app_environment=app_environment,
        azure_client_id=get("AZURE_CLIENT_ID"),
        pg_host=get("PGHOST") or "",
        pg_port=_int(env, "PGPORT", 5432, problems, 1, 65535),
        pg_database=get("PGDATABASE") or "",
        pg_user=get("PGUSER") or "",
        db_pool_max=_int(env, "DB_POOL_MAX", 5, problems, 1, 50),
        project_endpoint=get("AZURE_AI_PROJECT_ENDPOINT"),
        openai_endpoint=get("AZURE_OPENAI_ENDPOINT"),
        chat_deployment=get("AI_CHAT_DEPLOYMENT"),
        ai_requests_per_hour=_int(env, "AI_REQUESTS_PER_USER_PER_HOUR", 30, problems, 1, 10000),
        log_level=log_level,
        public_origin=get("APP_PUBLIC_ORIGIN"),
        dev_auth_bypass=bypass,
        dev_auth_roles=tuple(
            r.strip() for r in (get("DEV_AUTH_ROLES") or "App.Admin").split(",") if r.strip()
        ),
        port=_int(env, "PORT", 8080, problems, 1, 65535),
    )
    if problems:
        raise ValueError("Invalid configuration:\n  " + "\n  ".join(problems))
    return settings
