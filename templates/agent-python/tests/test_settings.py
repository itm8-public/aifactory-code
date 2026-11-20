import pytest

from app.settings import load_settings

BASE = {"PGHOST": "localhost", "PGDATABASE": "app", "PGUSER": "postgres"}


def test_defaults_to_port_8080_and_no_bypass():
    s = load_settings(BASE)
    assert s.port == 8080
    assert s.dev_auth_bypass is False
    assert s.in_azure is False


def test_refuses_the_dev_bypass_in_azure():
    env = {**BASE, "APP_ENVIRONMENT": "prod", "AZURE_CLIENT_ID": "id", "DEV_AUTH_BYPASS": "true"}
    with pytest.raises(ValueError, match="DEV_AUTH_BYPASS"):
        load_settings(env)


def test_needs_identity_and_model_in_azure():
    with pytest.raises(ValueError) as err:
        load_settings({**BASE, "APP_ENVIRONMENT": "dev"})
    for name in ("AZURE_CLIENT_ID", "AZURE_AI_PROJECT_ENDPOINT", "AI_CHAT_DEPLOYMENT"):
        assert name in str(err.value)


def test_refuses_secret_shaped_values_without_echoing_them():
    leaked = "postgres://user:" + "Sup3rSecret" + "@db.example/app"
    with pytest.raises(ValueError) as err:
        load_settings({**BASE, "PGHOST": leaked})
    assert "PGHOST" in str(err.value)
    assert "Sup3rSecret" not in str(err.value)
