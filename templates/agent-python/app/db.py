"""PostgreSQL connection pool.

In Azure the password is an Entra access token for the managed identity, fetched for each new
connection, with TLS verified: no password exists anywhere. Locally (no APP_ENVIRONMENT) the app
connects to the docker compose database, which trusts local connections.
"""

import psycopg
from psycopg_pool import AsyncConnectionPool

from .settings import Settings

PG_SCOPE = "https://ossrdbms-aad.database.windows.net/.default"
# Entra tokens live about an hour; recycle connections well before that.
MAX_LIFETIME_SECONDS = 30 * 60

_credential = None


async def _access_token(client_id: str | None) -> str:
    global _credential
    if _credential is None:
        from azure.identity.aio import DefaultAzureCredential, ManagedIdentityCredential

        _credential = (
            ManagedIdentityCredential(client_id=client_id) if client_id else DefaultAzureCredential()
        )
    token = await _credential.get_token(PG_SCOPE)
    return token.token


def create_pool(s: Settings, max_size: int | None = None) -> AsyncConnectionPool:
    kwargs: dict[str, object] = {
        "host": s.pg_host,
        "port": s.pg_port,
        "dbname": s.pg_database,
        "user": s.pg_user,
        "connect_timeout": 10,
        "sslmode": "verify-full" if s.in_azure else "disable",
    }
    connection_class: type[psycopg.AsyncConnection] = psycopg.AsyncConnection
    if s.in_azure:
        client_id = s.azure_client_id

        class EntraConnection(psycopg.AsyncConnection):
            @classmethod
            async def connect(cls, conninfo: str = "", **kw):  # type: ignore[override]
                kw["password"] = await _access_token(client_id)
                return await super().connect(conninfo, **kw)

        connection_class = EntraConnection
        kwargs["sslrootcert"] = "system"
    return AsyncConnectionPool(
        kwargs=kwargs,
        connection_class=connection_class,
        min_size=1,
        max_size=max_size or s.db_pool_max,
        max_lifetime=MAX_LIFETIME_SECONDS,
        open=False,
    )
