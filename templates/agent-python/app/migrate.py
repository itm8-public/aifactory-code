"""Applies the SQL migrations in migrations/ in order: `python -m app.migrate`.

In Azure this runs as its own Container Apps job with its own identity (the schema owner) before
each deploy. The running app never migrates; its identity gets data access only, granted here to
every role in DB_RUNTIME_ROLES, and only SELECT and INSERT on audit_log.
"""

import asyncio
import os
import re
import sys
from pathlib import Path

from psycopg import sql

from .db import create_pool
from .settings import Settings, load_settings

MIGRATIONS = Path(os.environ.get("MIGRATIONS_FOLDER", Path(__file__).resolve().parent.parent / "migrations"))
ROLE = re.compile(r"^[A-Za-z0-9 _.@-]{1,63}$")


def migration_files() -> list[tuple[str, str]]:
    """(version, SQL) for every file in migrations/, in order."""
    return [(p.stem, p.read_text(encoding="utf-8")) for p in sorted(MIGRATIONS.glob("*.sql"))]


async def run_migrations(s: Settings, runtime_roles: list[str]) -> list[str]:
    applied_now: list[str] = []
    files = migration_files()
    pool = create_pool(s, max_size=1)
    await pool.open()
    try:
        async with pool.connection() as conn:
            await conn.execute(
                "create table if not exists schema_migrations"
                " (version text primary key, applied_at timestamptz not null default now())"
            )
            done = {
                r[0] for r in await (await conn.execute("select version from schema_migrations")).fetchall()
            }
            for version, statements in files:
                if version in done:
                    continue
                async with conn.transaction():
                    await conn.execute(statements)
                    await conn.execute("insert into schema_migrations (version) values (%s)", (version,))
                applied_now.append(version)
            for name in runtime_roles:
                if not ROLE.match(name):
                    raise ValueError("DB_RUNTIME_ROLES holds a role name with unexpected characters")
                role = sql.Identifier(name)
                row = await (
                    await conn.execute("select has_schema_privilege(%s, 'public', 'USAGE')", (name,))
                ).fetchone()
                if not (row and row[0]):
                    await conn.execute(sql.SQL("grant usage on schema public to {}").format(role))
                for statement in (
                    "grant select, insert, update, delete on all tables in schema public to {}",
                    "grant usage, select on all sequences in schema public to {}",
                    "revoke update, delete, truncate on audit_log from {}",
                    "alter default privileges in schema public"
                    " grant select, insert, update, delete on tables to {}",
                    "alter default privileges in schema public grant usage, select on sequences to {}",
                ):
                    await conn.execute(sql.SQL(statement).format(role))
            await conn.commit()
    finally:
        await pool.close()
    return applied_now


def main() -> None:
    try:
        settings = load_settings()
        roles = [r.strip() for r in os.environ.get("DB_RUNTIME_ROLES", "").split(",") if r.strip()]
        applied = asyncio.run(run_migrations(settings, roles))
        print(f"Migrations applied: {', '.join(applied) or 'none new'}")
    except Exception as err:  # noqa: BLE001
        print(f"Migration failed: {type(err).__name__}: {err}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
