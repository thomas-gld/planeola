from core.security import (
    create_access_token,
    hash_password,
    hash_reset_token,
    password_problem,
    verify_password,
    verify_token,
)


def test_password_rule_accepts_a_light_but_real_password():
    assert password_problem("planning1") is None
    assert password_problem("Été 2026 !") is None


def test_password_rule_refuses_short_letterless_or_digitless_passwords():
    assert "8 characters" in password_problem("abc1234")
    assert "digit" in password_problem("abcdefgh")
    assert "letter" in password_problem("12345678")
    assert password_problem(None) is not None


def test_password_rule_refuses_the_email_whatever_the_case():
    assert "email" in password_problem("Jane.Doe42@Example.org", "jane.doe42@example.org")
    assert password_problem("jane.doe42@example.org", "someone-else@example.org") is None


def test_password_hash_roundtrip():
    h = hash_password("hunter2")
    assert h != "hunter2"
    assert verify_password("hunter2", h) is True
    assert verify_password("wrong", h) is False


def test_hash_reset_token_is_deterministic():
    digest = hash_reset_token("abc")
    assert digest == hash_reset_token("abc")
    assert digest != hash_reset_token("abd")
    assert len(digest) == 64


def test_jwt_roundtrip():
    token = create_access_token({"sub": "alice", "user_id": 7, "role": "admin"})
    payload = verify_token(token)
    assert payload is not None
    assert payload["sub"] == "alice"
    assert payload["user_id"] == 7
    assert payload["role"] == "admin"
    assert "exp" in payload


def test_verify_token_rejects_garbage():
    assert verify_token("not.a.jwt") is None
    assert verify_token("") is None


def test_access_token_short_expiry():
    import time

    token = create_access_token({"login_id": 1, "scope": "select"}, expires_minutes=10)
    payload = verify_token(token)
    assert payload is not None
    assert payload["scope"] == "select"
    delta = payload["exp"] - time.time()
    assert 8 * 60 < delta <= 10 * 60


def _import_config(**env):
    """Import core.config in a fresh interpreter, with `env` on top of ours."""
    import os
    import subprocess
    import sys

    return subprocess.run(
        [sys.executable, "-c", "import core.config as c; print(c.PRODUCTION)"],
        env={**os.environ, **env},
        capture_output=True,
        text=True,
    )


def test_a_deployment_refuses_a_short_secret_key():
    r = _import_config(APP_URL="https://planeola.example", SECRET_KEY="too-short")
    assert r.returncode != 0
    assert "SECRET_KEY must be at least 32 characters" in r.stderr


def test_a_deployment_accepts_a_long_secret_key():
    r = _import_config(APP_URL="https://planeola.example", SECRET_KEY="x" * 32)
    assert r.returncode == 0, r.stderr
    assert r.stdout.strip() == "True"


def test_local_runs_are_not_production():
    r = _import_config(APP_URL="http://localhost:8000", SECRET_KEY="short")
    assert r.stdout.strip() == "False"


def test_log_files_are_kept_six_months_at_most():
    """The privacy policy promises it."""
    from logging.handlers import TimedRotatingFileHandler

    from core.logging import logger

    handler = next(h for h in logger.handlers if isinstance(h, TimedRotatingFileHandler))
    assert handler.when == "MIDNIGHT"
    assert handler.backupCount == 180
