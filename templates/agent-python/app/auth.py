"""Who is calling: the Easy Auth principal.

Easy Auth signs every user in before a request reaches the app and passes the user in the
X-MS-CLIENT-PRINCIPAL header (base64 JSON). The app has no login of its own and keys users on
their Entra object id, never on e-mail or name. The header can be trusted only because the app
is reachable through Easy Auth alone.
"""

import base64
import json
from dataclasses import dataclass

OBJECT_ID = "http://schemas.microsoft.com/identity/claims/objectidentifier"
DEV_USER_ID = "00000000-0000-0000-0000-000000000001"


@dataclass(frozen=True)
class User:
    id: str
    name: str
    roles: tuple[str, ...]


def parse_principal(header: str | None, id_header: str | None = None) -> User | None:
    if not header:
        return None
    try:
        principal = json.loads(base64.b64decode(header, validate=True))
    except ValueError:
        return None
    if not isinstance(principal, dict):
        return None
    claims = [
        c
        for c in principal.get("claims") or []
        if isinstance(c, dict) and isinstance(c.get("typ"), str) and isinstance(c.get("val"), str)
    ]

    def get(typ: str) -> str | None:
        return next((c["val"] for c in claims if c["typ"] == typ), None)

    role_type = principal.get("role_typ") if isinstance(principal.get("role_typ"), str) else "roles"
    name_type = principal.get("name_typ") if isinstance(principal.get("name_typ"), str) else "name"
    user_id = get(OBJECT_ID) or get("oid") or id_header
    if not user_id:
        return None
    roles = tuple(dict.fromkeys(c["val"] for c in claims if c["typ"] in (role_type, "roles")))
    return User(id=user_id, name=get("name") or get(name_type) or "", roles=roles)


def dev_user(roles: tuple[str, ...]) -> User:
    return User(id=DEV_USER_ID, name="Local developer", roles=roles)
