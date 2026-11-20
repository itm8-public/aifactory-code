import psycopg

from app.auth import parse_principal
from tests.conftest import OTHER, USER, principal


def rows(settings, query):
    with psycopg.connect(
        host=settings.pg_host, port=settings.pg_port, dbname=settings.pg_database, user=settings.pg_user
    ) as conn:
        return conn.execute(query).fetchall()


def chat(client, text, user=USER):
    return client.post(
        "/api/chat", json={"messages": [{"role": "user", "content": text}]}, headers=principal(user)
    )


def test_health_needs_no_sign_in_and_sends_security_headers(client):
    res = client.get("/healthz")
    assert res.status_code == 200
    assert "frame-ancestors 'none'" in res.headers["content-security-policy"]
    assert "strict-transport-security" in res.headers
    assert client.get("/readyz").status_code == 200


def test_api_needs_a_signed_in_user(client):
    assert client.get("/api/me").status_code == 401
    me = client.get("/api/me", headers=principal(USER, ("App.Reader",)))
    assert me.json() == {"id": USER, "name": "Test user", "roles": ["App.Reader"]}
    assert parse_principal("not base64") is None


def test_refuses_a_change_from_another_site(client):
    res = client.post(
        "/api/chat",
        json={"messages": [{"role": "user", "content": "hi"}]},
        headers={**principal(USER), "origin": "https://evil.example"},
    )
    assert res.status_code == 403


def test_validation_names_fields_without_values(client):
    res = client.post("/api/chat", json={"messages": []}, headers=principal(USER))
    assert res.status_code == 400
    assert "messages" in res.json()["error"]


def test_agent_reads_proposes_and_changes_nothing_until_approved(client, model, settings):
    model.script = [("search_items", {"query": "report"}), ("create_item", {"title": "Weekly report"})]
    body = chat(client, "Create a weekly report item").json()
    assert body["status"] == "answered"
    assert body["toolsUsed"] == ["search_items", "create_item"]
    assert len(body["proposals"]) == 1
    assert rows(settings, "select * from items") == []

    action_id = body["proposals"][0]["id"]
    decided = client.post(
        f"/api/actions/{action_id}/decision", json={"approve": True}, headers=principal(USER)
    )
    assert decided.json()["status"] == "approved"
    assert rows(settings, "select title from items") == [("Weekly report",)]
    assert sorted(r[0] for r in rows(settings, "select action from audit_log")) == [
        "agent-action-approved",
        "create",
    ]


def test_only_the_same_user_decides_and_only_once(client, model, settings):
    model.script = [("create_item", {"title": "Mine"})]
    action_id = chat(client, "Add mine").json()["proposals"][0]["id"]
    url = f"/api/actions/{action_id}/decision"
    assert (
        client.post(url, json={"approve": True}, headers=principal(OTHER, ("App.Admin",))).status_code == 404
    )
    assert client.post(url, json={"approve": False}, headers=principal(USER)).json()["status"] == "rejected"
    assert client.post(url, json={"approve": True}, headers=principal(USER)).status_code == 409
    assert rows(settings, "select * from items") == []


def test_invalid_proposals_are_refused(client, model, settings):
    model.script = [("create_item", {"title": "  "})]
    body = chat(client, "Add nothing").json()
    assert body["proposals"] == []
    assert rows(settings, "select * from agent_actions") == []


def test_per_user_ai_limit(client, settings):
    with psycopg.connect(
        host=settings.pg_host, port=settings.pg_port, dbname=settings.pg_database, user=settings.pg_user
    ) as conn:
        for _ in range(settings.ai_requests_per_hour):
            conn.execute("insert into ai_usage (user_id) values (%s)", (USER,))
    assert chat(client, "One more").json() == {
        "status": "try-later",
        "reason": "limit",
        "retryAfterSeconds": 900,
    }
