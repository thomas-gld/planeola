"""Tests run against the local database. Each registers its own account, and every
`pytest-…` login is deleted at the end of the session."""
import asyncio
import json
import smtplib
import uuid
from datetime import datetime

import pytest

from core.limiter import limiter

limiter.enabled = False

import main  # noqa: E402

TEST_EMAIL_PREFIX = "pytest-"
TEST_PASSWORD = "secret123"


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient
    with TestClient(main.app) as c:
        yield c


@pytest.fixture
def unique_email():
    return f"{TEST_EMAIL_PREFIX}{uuid.uuid4().hex[:12]}@example.test"


@pytest.fixture
def password():
    return TEST_PASSWORD


@pytest.fixture
def auth():
    def _auth(token):
        return {"Authorization": f"Bearer {token}"}
    return _auth


class SmtpAttempted(BaseException):
    """Not an Exception: _send catches those and would swallow the alarm."""


def _refuse_smtp(*args, **kwargs):
    raise SmtpAttempted("the test suite tried to open an SMTP connection")


@pytest.fixture(autouse=True)
def no_outgoing_email(monkeypatch):
    """Unset SMTP_* so _send bails out, as in CI. Break smtplib in case it ever doesn't."""
    for var in ("SMTP_HOST", "SMTP_USERNAME", "SMTP_PASSWORD", "SMTP_FROM_EMAIL"):
        monkeypatch.delenv(var, raising=False)

    monkeypatch.setattr(smtplib, "SMTP", _refuse_smtp)
    monkeypatch.setattr(smtplib, "SMTP_SSL", _refuse_smtp)


@pytest.fixture(autouse=True)
def verification_codes(monkeypatch):
    """Emailed codes by recipient: the database only holds their hash."""
    import routers.auth as auth_router

    codes = {}

    def _capture(recipient_email, code, lang):
        codes[recipient_email.strip().lower()] = code
        return True

    monkeypatch.setattr(auth_router, "send_verification_code_email", _capture)
    return codes


@pytest.fixture(autouse=True)
def reset_links(monkeypatch):
    """Emailed reset links by recipient: the database only holds their digest."""
    import routers.auth as auth_router

    links = {}

    def _capture(recipient_email, recipient_name, reset_url, expires_in_minutes, lang):
        links[recipient_email.strip().lower()] = reset_url
        return True

    monkeypatch.setattr(auth_router, "send_password_reset_email", _capture)
    return links


@pytest.fixture
def reset_token(client, reset_links):
    from urllib.parse import parse_qs, urlparse

    def _reset_token(email):
        r = client.post("/api/auth/forgot-password", json={"email": email})
        assert r.status_code == 200, r.text
        url = reset_links[email.strip().lower()]
        return parse_qs(urlparse(url).query)["token"][0]
    return _reset_token


@pytest.fixture
def verify(client, verification_codes):
    def _verify(email):
        code = verification_codes[email.strip().lower()]
        r = client.post("/api/auth/verify-email", json={"email": email, "code": code})
        assert r.status_code == 200, r.text
        return r.json()
    return _verify


@pytest.fixture
def register(client, verify):
    """Register, verify, create an organization. Returns (admin_token, email)."""
    def _register(email=None, password=TEST_PASSWORD, org_name="Test Org"):
        email = email or f"{TEST_EMAIL_PREFIX}{uuid.uuid4().hex[:12]}@example.test"
        r = client.post("/api/auth/register", json={"email": email, "password": password})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "verification_required"

        orgless_token = verify(email)["access_token"]

        c = client.post("/api/auth/create-organization",
                        json={"org_name": org_name},
                        headers={"Authorization": f"Bearer {orgless_token}"})
        assert c.status_code == 200, c.text
        return c.json()["access_token"], email
    return _register


@pytest.fixture
def member_session(client, verify, register):
    """An organization with one member who accepted their invitation.
    Returns (admin_token, member_token, member_id)."""
    def _member_session(org_name="Test Org", categories=("member",)):
        admin_token, _ = register(org_name=org_name)
        admin = {"Authorization": f"Bearer {admin_token}"}
        email = f"{TEST_EMAIL_PREFIX}{uuid.uuid4().hex[:12]}@example.test"

        created = client.post("/api/members", headers=admin, json={
            "last_name": "member", "first_name": "Pat",
            "categories": list(categories), "email": email,
        })
        assert created.status_code == 200, created.text
        member_id = created.json()["id"]

        invited = client.post(f"/api/members/{member_id}/create-account", headers=admin)
        assert invited.status_code == 200, invited.text

        client.post("/api/auth/register", json={"email": email, "password": TEST_PASSWORD})
        orgless = {"Authorization": f"Bearer {verify(email)['access_token']}"}
        invites = client.get("/api/auth/pending-invites", headers=orgless).json()["invites"]
        assert len(invites) == 1
        accepted = client.post(f"/api/auth/invites/{invites[0]['id']}/accept", headers=orgless)
        assert accepted.status_code == 200, accepted.text

        return admin_token, accepted.json()["access_token"], member_id
    return _member_session


@pytest.fixture(scope="session")
def _sync_engine():
    """Sync, to stay out of the event loop TestClient drives."""
    from sqlalchemy import create_engine

    from db import SYNC_DATABASE_URL

    engine = create_engine(SYNC_DATABASE_URL)
    yield engine
    engine.dispose()


@pytest.fixture
def submissions_table(_sync_engine):
    """The API drops past dates, so an expired submission can only be made here."""
    from sqlalchemy.orm import Session as SyncSession

    from models import AvailabilitySubmission, Member

    class Table:
        def store(self, member_id: int, dates: list) -> int:
            with SyncSession(_sync_engine) as s, s.begin():
                submission = AvailabilitySubmission(
                    account_id=s.get(Member, member_id).account_id,
                    member_id=member_id,
                    dates=json.dumps(dates),
                    status="pending",
                )
                s.add(submission)
                s.flush()
                return submission.id

        def dates_of(self, submission_id: int) -> list | None:
            with SyncSession(_sync_engine) as s:
                submission = s.get(AvailabilitySubmission, submission_id)
                return None if submission is None else json.loads(submission.dates)

    return Table()


@pytest.fixture
def expire_reset_link(_sync_engine):
    from sqlalchemy import func, select
    from sqlalchemy.orm import Session as SyncSession

    from models import Login

    def _expire(email: str):
        with SyncSession(_sync_engine) as s, s.begin():
            login = s.scalar(
                select(Login).where(func.lower(Login.email) == email.strip().lower())
            )
            assert login is not None and login.reset_expires_at is not None
            login.reset_expires_at = datetime(2000, 1, 1)

    return _expire


@pytest.fixture(scope="session", autouse=True)
def _cleanup_test_data():
    yield

    async def clean():
        from sqlalchemy import delete, select
        from sqlalchemy.orm import selectinload

        from db import Session, engine
        from models import Account, Login

        async with Session() as session, session.begin():
            logins = (
                await session.scalars(
                    select(Login)
                    .where(Login.email.startswith(TEST_EMAIL_PREFIX))
                    .options(selectinload(Login.users))
                )
            ).all()
            account_ids = {u.account_id for lg in logins for u in lg.users}
            login_ids = [lg.id for lg in logins]

            if account_ids:
                await session.execute(delete(Account).where(Account.id.in_(account_ids)))
            if login_ids:
                await session.execute(delete(Login).where(Login.id.in_(login_ids)))
        await engine.dispose()

    asyncio.run(clean())
