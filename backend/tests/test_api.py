import json
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from core.options import DEFAULT_TIMEZONE


def today(tz: str = DEFAULT_TIMEZONE) -> date:
    """Test organizations set no time zone, so they live in the default one."""
    return datetime.now(ZoneInfo(tz)).date()


def day(offset: int) -> str:
    return (today() + timedelta(days=offset)).isoformat()


def month_edges() -> tuple[str, str]:
    first = today().replace(day=1)
    last = (first + timedelta(days=32)).replace(day=1) - timedelta(days=1)
    return first.isoformat(), last.isoformat()


def next_month_day() -> str:
    first = today().replace(day=1)
    return (first + timedelta(days=32)).replace(day=15).isoformat()


def test_register_requires_the_emailed_code(client, unique_email, auth, password, verify):
    r = client.post("/api/auth/register", json={"email": unique_email, "password": password})
    assert r.status_code == 200, r.text
    assert r.json() == {"status": "verification_required", "email": unique_email}

    early = client.post("/api/auth/login", json={"email": unique_email, "password": password})
    assert early.status_code == 200
    assert early.json()["status"] == "verification_required"
    assert "access_token" not in early.json()

    body = verify(unique_email)
    assert body["accounts"] == []
    v = client.post("/api/auth/verify", headers=auth(body["access_token"]))
    assert v.status_code == 200
    assert v.json()["valid"] is True

    assert (
        "access_token"
        in client.post("/api/auth/login", json={"email": unique_email, "password": password}).json()
    )


def test_verify_email_rejects_a_wrong_code_and_locks_out_after_5_tries(
    client, unique_email, password, verification_codes, verify
):
    client.post("/api/auth/register", json={"email": unique_email, "password": password})
    real_code = verification_codes[unique_email]
    wrong = "000000" if real_code != "000000" else "111111"

    for _ in range(5):
        r = client.post("/api/auth/verify-email", json={"email": unique_email, "code": wrong})
        assert r.status_code == 400

    assert (
        client.post(
            "/api/auth/verify-email", json={"email": unique_email, "code": real_code}
        ).status_code
        == 429
    )

    assert client.post("/api/auth/resend-code", json={"email": unique_email}).status_code == 200
    assert "access_token" in verify(unique_email)


def test_forgot_password_leaves_the_password_alone(client, register, password, reset_links):
    """Otherwise anyone knowing an address could lock its owner out."""
    _, email = register()

    for _ in range(3):
        assert client.post("/api/auth/forgot-password", json={"email": email}).status_code == 200

    assert (
        client.post("/api/auth/login", json={"email": email, "password": password}).status_code
        == 200
    )
    assert email in reset_links


def test_forgot_password_says_the_same_thing_for_an_unknown_address(client, register, reset_links):
    _, known = register()
    unknown = "pytest-nobody-here@example.test"

    known_answer = client.post("/api/auth/forgot-password", json={"email": known})
    unknown_answer = client.post("/api/auth/forgot-password", json={"email": unknown})

    assert known_answer.status_code == unknown_answer.status_code == 200
    assert known_answer.json() == unknown_answer.json()
    assert unknown not in reset_links


def test_reset_password_link_sets_a_new_password_once(client, register, password, reset_token):
    _, email = register()
    token = reset_token(email)

    r = client.post(
        "/api/auth/reset-password", json={"token": token, "new_password": "brand-new-pw1"}
    )
    assert r.status_code == 200, r.text

    assert (
        client.post(
            "/api/auth/login", json={"email": email, "password": "brand-new-pw1"}
        ).status_code
        == 200
    )
    assert (
        client.post("/api/auth/login", json={"email": email, "password": password}).status_code
        == 401
    )

    assert (
        client.post(
            "/api/auth/reset-password", json={"token": token, "new_password": "another-pw2"}
        ).status_code
        == 400
    )


def test_reset_password_rejects_bad_tokens_and_short_passwords(client, register, reset_token):
    _, email = register()
    token = reset_token(email)

    assert (
        client.post(
            "/api/auth/reset-password", json={"token": "made-up", "new_password": "brand-new-pw1"}
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/auth/reset-password", json={"token": "", "new_password": "brand-new-pw1"}
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/auth/reset-password", json={"token": token, "new_password": "short"}
        ).status_code
        == 400
    )

    assert (
        client.post(
            "/api/auth/reset-password", json={"token": token, "new_password": "brand-new-pw1"}
        ).status_code
        == 200
    )


def test_reset_password_refuses_an_expired_link(client, register, reset_token, expire_reset_link):
    _, email = register()
    token = reset_token(email)
    expire_reset_link(email)

    assert (
        client.post(
            "/api/auth/reset-password", json={"token": token, "new_password": "brand-new-pw1"}
        ).status_code
        == 400
    )


def test_unverified_email_cannot_claim_an_invitation(
    client, register, auth, unique_email, password
):
    """Registering someone else's address must not pick up their invitations."""
    admin_token, _ = register(org_name="PrivateOrg")
    h = auth(admin_token)
    m = client.post(
        "/api/members",
        headers=h,
        json={
            "last_name": "target",
            "first_name": "Vic",
            "categories": ["member"],
            "email": unique_email,
        },
    )
    mid = m.json()["id"]
    assert client.post(f"/api/members/{mid}/create-account", headers=h).status_code == 200

    r = client.post("/api/auth/register", json={"email": unique_email, "password": password})
    assert r.json()["status"] == "verification_required"
    assert "access_token" not in r.json()
    assert (
        client.post("/api/auth/login", json={"email": unique_email, "password": password}).json()[
            "status"
        ]
        == "verification_required"
    )


def test_register_can_reclaim_an_unverified_squatted_address(client, unique_email, verify):
    """An unverified Login owns nothing, so the real owner can take the address back."""
    client.post("/api/auth/register", json={"email": unique_email, "password": "squatter-pw1"})

    r = client.post("/api/auth/register", json={"email": unique_email, "password": "realowner-pw1"})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "verification_required"

    assert "access_token" in verify(unique_email)
    assert (
        client.post(
            "/api/auth/login", json={"email": unique_email, "password": "realowner-pw1"}
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/auth/login", json={"email": unique_email, "password": "squatter-pw1"}
        ).status_code
        == 401
    )


@pytest.mark.parametrize("weak", ["abc123", "onlyletters", "12345678"])
def test_register_rejects_a_weak_password(client, unique_email, weak):
    r = client.post("/api/auth/register", json={"email": unique_email, "password": weak})
    assert r.status_code == 400


def test_register_rejects_the_email_as_password(client):
    email = "pytest-pw1234@example.test"
    r = client.post("/api/auth/register", json={"email": email, "password": email.upper()})
    assert r.status_code == 400
    assert "email" in r.json()["detail"]


def test_change_password_applies_the_same_rule(client, register, auth, password):
    token, email = register()
    h = auth(token)

    weak = client.post(
        "/api/auth/change-password",
        headers=h,
        json={"current_password": password, "new_password": "short1"},
    )
    assert weak.status_code == 400
    assert (
        client.post("/api/auth/login", json={"email": email, "password": password}).status_code
        == 200
    )

    ok = client.post(
        "/api/auth/change-password",
        headers=h,
        json={"current_password": password, "new_password": "longer-pw1"},
    )
    assert ok.status_code == 200, ok.text
    assert (
        client.post("/api/auth/login", json={"email": email, "password": "longer-pw1"}).status_code
        == 200
    )


def test_reset_password_rejects_a_password_without_a_digit(client, register, reset_token):
    _, email = register()
    token = reset_token(email)

    r = client.post(
        "/api/auth/reset-password", json={"token": token, "new_password": "no-digits-here"}
    )
    assert r.status_code == 400
    assert "digit" in r.json()["detail"]


def test_login_then_switch_account(client, register, auth, password):
    token, email = register(org_name="MyOrg")

    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    body = r.json()
    assert "select_token" in body
    assert len(body["accounts"]) == 1
    acc = body["accounts"][0]
    assert acc["role"] == "admin"
    assert acc["name"] == "MyOrg"

    sw = client.post(
        "/api/auth/switch-account",
        json={"user_id": acc["user_id"]},
        headers=auth(body["select_token"]),
    )
    assert sw.status_code == 200
    full = sw.json()["access_token"]

    me = client.get("/api/auth/my-accounts", headers=auth(full))
    assert me.status_code == 200
    assert me.json()["current_account_id"] == acc["account_id"]
    assert me.json()["email"] == email


def test_default_organization_auto_opens_on_login(client, register, auth, password):
    token1, email = register(org_name="OrgOne")
    h1 = auth(token1)
    org2 = client.post("/api/auth/create-organization", json={"org_name": "OrgTwo"}, headers=h1)
    assert org2.status_code == 200, org2.text
    token2 = org2.json()["access_token"]
    h2 = auth(token2)

    r = client.post("/api/auth/login", json={"email": email, "password": password})
    body = r.json()
    assert len(body["accounts"]) == 2
    org_two_entry = next(a for a in body["accounts"] if a["name"] == "OrgTwo")

    set_default = client.put(
        "/api/auth/default-account", json={"user_id": org_two_entry["user_id"]}, headers=h2
    )
    assert set_default.status_code == 200, set_default.text
    assert (
        client.get("/api/auth/my-accounts", headers=h1).json()["default_user_id"]
        == org_two_entry["user_id"]
    )

    r2 = client.post("/api/auth/login", json={"email": email, "password": password})
    body2 = r2.json()
    assert body2["accounts"] == []
    assert "access_token" in body2
    my_accounts = client.get("/api/auth/my-accounts", headers=auth(body2["access_token"])).json()
    assert my_accounts["current_account_id"] == org_two_entry["account_id"]

    clear = client.put("/api/auth/default-account", json={"user_id": None}, headers=h2)
    assert clear.status_code == 200, clear.text
    r3 = client.post("/api/auth/login", json={"email": email, "password": password})
    assert len(r3.json()["accounts"]) == 2


def test_default_account_must_belong_to_login(client, register, auth):
    token_a, _ = register()
    token_b, _ = register()
    other_user_id = client.get("/api/auth/my-accounts", headers=auth(token_b)).json()["current_user_id"]

    r = client.put(
        "/api/auth/default-account", json={"user_id": other_user_id}, headers=auth(token_a)
    )
    assert r.status_code == 404


def test_login_wrong_password(client, register):
    _, email = register()
    r = client.post("/api/auth/login", json={"email": email, "password": "nope"})
    assert r.status_code == 401


def test_unauthenticated_endpoints_401(client):
    assert client.get("/api/options").status_code == 401
    assert client.get("/api/members").status_code == 401
    assert client.get("/api/assignments").status_code == 401


def test_unknown_api_route_is_a_404_not_the_app_page(client):
    r = client.get("/api/does-not-exist")
    assert r.status_code == 404
    assert "html" not in r.headers.get("content-type", "")


def test_security_headers_are_set(client):
    headers = client.get("/api/options").headers
    assert headers["referrer-policy"] == "same-origin"
    assert headers["x-frame-options"] == "DENY"
    assert "default-src 'self'" in headers["content-security-policy"]


def test_member_crud_and_name_normalization(client, register, auth):
    token, _ = register()
    h = auth(token)

    created = client.post(
        "/api/members",
        headers=h,
        json={"last_name": "doe", "first_name": "jOHN", "categories": ["member"]},
    )
    assert created.status_code == 200, created.text
    m = created.json()
    assert m["last_name"] == "DOE"
    assert m["first_name"] == "John"
    mid = m["id"]

    listed = client.get("/api/members", headers=h)
    assert listed.status_code == 200
    assert any(x["id"] == mid for x in listed.json())

    upd = client.put(
        f"/api/members/{mid}",
        headers=h,
        json={
            "last_name": "DOE",
            "first_name": "John",
            "categories": ["member"],
            "phone": "0102030405",
        },
    )
    assert upd.status_code == 200
    assert upd.json()["phone"] == "0102030405"

    assert client.put(f"/api/members/{mid}/resign", headers=h).status_code == 200
    assert client.put(f"/api/members/{mid}/reinstate", headers=h).status_code == 200
    assert client.delete(f"/api/members/{mid}", headers=h).status_code == 200
    assert client.get(f"/api/members/{mid}", headers=h).status_code == 404


def test_a_member_needs_a_category(client, register, auth):
    token, _ = register()
    h = auth(token)
    member = {"last_name": "doe", "first_name": "john"}
    for categories in ([], [" "]):
        r = client.post("/api/members", headers=h, json={**member, "categories": categories})
        assert r.status_code == 400

    created = client.post("/api/members", headers=h, json={**member, "categories": ["member"]})
    mid = created.json()["id"]
    r = client.put(f"/api/members/{mid}", headers=h, json={**member, "categories": []})
    assert r.status_code == 400
    assert client.get(f"/api/members/{mid}", headers=h).json()["categories"] == ["member"]


def test_cross_tenant_isolation(client, register, auth):
    token_a, _ = register()
    token_b, _ = register()

    ma = client.post(
        "/api/members",
        headers=auth(token_a),
        json={"last_name": "secret", "first_name": "Alice", "categories": ["member"]},
    )
    mid_a = ma.json()["id"]

    assert client.get(f"/api/members/{mid_a}", headers=auth(token_b)).status_code == 404


def test_create_account_requires_member_email(client, register, auth):
    token, _ = register()
    h = auth(token)
    m = client.post(
        "/api/members",
        headers=h,
        json={"last_name": "noemail", "first_name": "Bob", "categories": ["member"]},
    )
    mid = m.json()["id"]
    r = client.post(f"/api/members/{mid}/create-account", headers=h)
    assert r.status_code == 400
    assert "email" in r.json()["detail"].lower()


def test_login_with_no_organizations_then_create_one(
    client, register, unique_email, password, auth, verify
):
    admin_token, _ = register(org_name="ParentOrg")
    h = auth(admin_token)
    m = client.post(
        "/api/members",
        headers=h,
        json={
            "last_name": "gone",
            "first_name": "Casey",
            "categories": ["member"],
            "email": unique_email,
        },
    )
    mid = m.json()["id"]
    invited = client.post(f"/api/members/{mid}/create-account", headers=h)
    assert invited.status_code == 200, invited.text

    reg = client.post("/api/auth/register", json={"email": unique_email, "password": password})
    assert reg.status_code == 200, reg.text
    orgless_token = verify(unique_email)["access_token"]
    pending = client.get("/api/auth/pending-invites", headers=auth(orgless_token)).json()["invites"]
    assert len(pending) == 1
    accept = client.post(
        f"/api/auth/invites/{pending[0]['id']}/accept", headers=auth(orgless_token)
    )
    assert accept.status_code == 200, accept.text

    assert client.put(f"/api/members/{mid}/resign", headers=h).status_code == 200

    login = client.post("/api/auth/login", json={"email": unique_email, "password": password})
    assert login.status_code == 200, login.text
    body = login.json()
    assert body["accounts"] == []
    orgless_token = body["access_token"]
    assert client.post("/api/auth/verify", headers=auth(orgless_token)).status_code == 200

    r = client.post(
        "/api/auth/create-organization", json={"org_name": "FreshOrg"}, headers=auth(orgless_token)
    )
    assert r.status_code == 200, r.text
    new_token = r.json()["access_token"]

    accounts = client.get("/api/auth/my-accounts", headers=auth(new_token)).json()["accounts"]
    assert len(accounts) == 1
    assert accounts[0]["role"] == "admin"
    assert accounts[0]["name"] == "FreshOrg"


def test_create_organization_requires_name(client, register, auth):
    token, _ = register()
    r = client.post("/api/auth/create-organization", json={"org_name": "   "}, headers=auth(token))
    assert r.status_code == 400


def test_existing_admin_can_create_second_organization(client, register, auth):
    token, _ = register(org_name="FirstOrg")
    r = client.post(
        "/api/auth/create-organization", json={"org_name": "SecondOrg"}, headers=auth(token)
    )
    assert r.status_code == 200, r.text
    new_token = r.json()["access_token"]
    names = sorted(
        a["name"]
        for a in client.get("/api/auth/my-accounts", headers=auth(new_token)).json()["accounts"]
    )
    assert names == ["FirstOrg", "SecondOrg"]


def test_admin_can_also_be_a_member_in_same_org(client, register, auth):
    token, email = register(org_name="DualRoleOrg")
    h = auth(token)

    m = client.post(
        "/api/members",
        headers=h,
        json={"last_name": "self", "first_name": "Admin", "categories": ["member"], "email": email},
    )
    assert m.status_code == 200, m.text
    mid = m.json()["id"]

    linked = client.post(f"/api/members/{mid}/create-account", headers=h)
    assert linked.status_code == 200, linked.text
    assert linked.json()["status"] == "linked"
    assert client.get("/api/auth/pending-invites", headers=h).json()["invites"] == []

    accounts = client.get("/api/auth/my-accounts", headers=h).json()["accounts"]
    same_org = [a for a in accounts if a["account_id"] == accounts[0]["account_id"]]
    assert sorted(a["role"] for a in same_org) == ["admin", "member"]
    assert len({a["user_id"] for a in same_org}) == 2

    listed = client.get("/api/members", headers=h).json()
    assert next(x for x in listed if x["id"] == mid)["invite_status"] == "accepted"

    member_entry = next(a for a in same_org if a["role"] == "member")
    sw = client.post(
        "/api/auth/switch-account", json={"user_id": member_entry["user_id"]}, headers=h
    )
    assert sw.status_code == 200, sw.text

    m2 = client.post(
        "/api/members",
        headers=h,
        json={"last_name": "dup", "first_name": "Admin", "categories": ["member"], "email": email},
    )
    assert m2.status_code == 400


def test_invite_can_be_cancelled_or_declined(client, register, unique_email, auth, verify):
    token, _ = register(org_name="InviteOrg")
    h = auth(token)

    m = client.post(
        "/api/members",
        headers=h,
        json={
            "last_name": "cancel",
            "first_name": "Sam",
            "categories": ["member"],
            "email": unique_email,
        },
    )
    mid = m.json()["id"]
    assert client.post(f"/api/members/{mid}/create-account", headers=h).status_code == 200

    assert client.post(f"/api/members/{mid}/create-account", headers=h).status_code == 400

    assert client.delete(f"/api/members/{mid}/invitation", headers=h).status_code == 200
    assert client.delete(f"/api/members/{mid}/invitation", headers=h).status_code == 404
    reinvited = client.post(f"/api/members/{mid}/create-account", headers=h)
    assert reinvited.status_code == 200, reinvited.text

    reg = client.post("/api/auth/register", json={"email": unique_email, "password": "secret123"})
    assert reg.status_code == 200, reg.text
    invitee_token = verify(unique_email)["access_token"]
    pending = client.get("/api/auth/pending-invites", headers=auth(invitee_token)).json()["invites"]
    assert len(pending) == 1
    decline = client.post(
        f"/api/auth/invites/{pending[0]['id']}/decline", headers=auth(invitee_token)
    )
    assert decline.status_code == 200, decline.text
    assert (
        client.get("/api/auth/pending-invites", headers=auth(invitee_token)).json()["invites"] == []
    )

    listed = client.get("/api/members", headers=h).json()
    assert next(x for x in listed if x["id"] == mid)["invite_status"] == "none"


def test_invite_can_be_resent_until_accepted(client, register, unique_email, auth, verify):
    token, _ = register(org_name="ResendOrg")
    h = auth(token)

    m = client.post(
        "/api/members",
        headers=h,
        json={
            "last_name": "resend",
            "first_name": "Sam",
            "categories": ["member"],
            "email": unique_email,
        },
    )
    mid = m.json()["id"]
    resend = f"/api/members/{mid}/invitation/resend"

    assert client.post(resend, headers=h).status_code == 404

    assert client.post(f"/api/members/{mid}/create-account", headers=h).status_code == 200

    for _ in range(3):
        again = client.post(resend, headers=h)
        assert again.status_code == 200, again.text
        assert again.json()["email"] == unique_email
    listed = client.get("/api/members", headers=h).json()
    assert next(x for x in listed if x["id"] == mid)["invite_status"] == "pending"

    client.post("/api/auth/register", json={"email": unique_email, "password": "secret123"})
    invitee_token = verify(unique_email)["access_token"]
    pending = client.get("/api/auth/pending-invites", headers=auth(invitee_token)).json()["invites"]
    client.post(f"/api/auth/invites/{pending[0]['id']}/accept", headers=auth(invitee_token))
    assert client.post(resend, headers=h).status_code == 404


def test_resend_is_scoped_to_the_admin_organization(client, register, unique_email, auth):
    owner_token, _ = register(org_name="OwnerOrg")
    m = client.post(
        "/api/members",
        headers=auth(owner_token),
        json={
            "last_name": "scoped",
            "first_name": "Sam",
            "categories": ["member"],
            "email": unique_email,
        },
    )
    mid = m.json()["id"]
    client.post(f"/api/members/{mid}/create-account", headers=auth(owner_token))

    outsider_token, _ = register(org_name="OutsiderOrg")
    assert (
        client.post(
            f"/api/members/{mid}/invitation/resend", headers=auth(outsider_token)
        ).status_code
        == 404
    )




def test_register_existing_email_requires_correct_password(client, unique_email, password, verify):
    client.post("/api/auth/register", json={"email": unique_email, "password": password})
    verify(unique_email)  # only a verified identity is protected from re-registration

    bad = client.post("/api/auth/register", json={"email": unique_email, "password": "wrongpass"})
    assert bad.status_code == 400
    ok = client.post("/api/auth/register", json={"email": unique_email, "password": password})
    assert ok.status_code == 200
    assert ok.json()["accounts"] == []


def test_toggle_day_uses_exceptions_only_when_they_differ_from_the_grid(client, register, auth):
    token, _ = register()
    h = auth(token)
    WEEKDAY = "2026-08-05"  # Wednesday
    WEEKEND = "2026-08-08"  # Saturday

    def state():
        return {
            "holidays": client.get("/api/holidays", headers=h).json(),
            "open_days": json.loads(
                client.get("/api/options", headers=h).json().get("open_days") or "[]"
            ),
        }

    r = client.post("/api/holidays/toggle", headers=h, json={"date": WEEKDAY})
    assert r.status_code == 200, r.text
    assert r.json()["is_open"] is False
    assert WEEKDAY in state()["holidays"]

    assert (
        client.post("/api/holidays/toggle", headers=h, json={"date": WEEKDAY}).json()["is_open"]
        is True
    )
    after = state()
    assert WEEKDAY not in after["holidays"]
    assert WEEKDAY not in after["open_days"]

    r = client.post("/api/holidays/toggle", headers=h, json={"date": WEEKEND})
    assert r.json()["is_open"] is True
    assert WEEKEND in state()["open_days"]

    assert (
        client.post("/api/holidays/toggle", headers=h, json={"date": WEEKEND}).json()["is_open"]
        is False
    )
    after = state()
    assert WEEKEND not in after["open_days"]
    assert WEEKEND not in after["holidays"]


def test_toggle_day_follows_a_changed_weekly_grid(client, register, auth):
    token, _ = register()
    h = auth(token)
    SATURDAY = "2026-08-08"

    assert client.post("/api/options", headers=h, json={"closed_days": "[0]"}).status_code == 200

    r = client.post("/api/holidays/toggle", headers=h, json={"date": SATURDAY})
    assert r.status_code == 200, r.text
    assert r.json()["is_open"] is False
    assert SATURDAY in client.get("/api/holidays", headers=h).json()


def test_toggle_day_rejects_a_bad_date(client, register, auth):
    token, _ = register()
    h = auth(token)
    assert (
        client.post("/api/holidays/toggle", headers=h, json={"date": "not-a-date"}).status_code
        == 400
    )
    assert client.post("/api/holidays/toggle", headers=h, json={"date": ""}).status_code == 400


def test_options_roundtrip(client, register, auth):
    token, _ = register()
    h = auth(token)
    assert (
        client.post(
            "/api/options", headers=h, json={"manager_email": "lead@example.com"}
        ).status_code
        == 200
    )
    opts = client.get("/api/options", headers=h).json()
    assert opts["manager_email"] == "lead@example.com"


def test_options_reject_an_unknown_time_zone(client, register, auth):
    token, _ = register()
    h = auth(token)
    assert (
        client.post("/api/options", headers=h, json={"timezone": "Mars/Olympus"}).status_code == 400
    )
    assert "timezone" not in client.get("/api/options", headers=h).json()
    assert (
        client.post("/api/options", headers=h, json={"timezone": "America/Montreal"}).status_code
        == 200
    )
    assert client.get("/api/options", headers=h).json()["timezone"] == "America/Montreal"


def test_assignments_roundtrip_keeps_the_nested_shape(client, register, auth):
    token, _ = register()
    h = auth(token)
    m1 = client.post(
        "/api/members",
        headers=h,
        json={"last_name": "one", "first_name": "Ann", "categories": ["member"]},
    ).json()
    m2 = client.post(
        "/api/members",
        headers=h,
        json={"last_name": "two", "first_name": "Bob", "categories": ["lead"]},
    ).json()
    date = day(3)

    saved = client.post(
        "/api/assignments",
        headers=h,
        json={
            date: {"morning": {"member": [m1["id"]], "lead": [m2["id"]]}},
        },
    )
    assert saved.status_code == 200, saved.text

    grid = client.get("/api/assignments", headers=h).json()
    assert grid[date]["morning"]["member"] == [m1["id"]]
    assert grid[date]["morning"]["lead"] == [m2["id"]]


def test_assignments_replace_the_whole_category(client, register, auth):
    token, _ = register()
    h = auth(token)
    ids = [
        client.post(
            "/api/members",
            headers=h,
            json={"last_name": n, "first_name": n, "categories": ["member"]},
        ).json()["id"]
        for n in ("aa", "bb", "cc")
    ]
    date = day(4)

    client.post("/api/assignments", headers=h, json={date: {"morning": {"member": ids}}})
    assert sorted(
        client.get("/api/assignments", headers=h).json()[date]["morning"]["member"]
    ) == sorted(ids)

    client.post("/api/assignments", headers=h, json={date: {"morning": {"member": ids[:1]}}})
    assert client.get("/api/assignments", headers=h).json()[date]["morning"]["member"] == ids[:1]

    client.post("/api/assignments", headers=h, json={date: {"morning": {"member": []}}})
    assert client.get("/api/assignments", headers=h).json() == {}


def test_assignments_only_touch_the_posted_slots(client, register, auth):
    token, _ = register()
    h = auth(token)
    mid = client.post(
        "/api/members",
        headers=h,
        json={"last_name": "keep", "first_name": "Kim", "categories": ["member"]},
    ).json()["id"]
    date = day(5)

    client.post(
        "/api/assignments",
        headers=h,
        json={
            date: {"morning": {"member": [mid]}, "afternoon": {"member": [mid]}},
        },
    )
    client.post("/api/assignments", headers=h, json={date: {"morning": {"member": []}}})

    grid = client.get("/api/assignments", headers=h).json()
    assert "morning" not in grid[date]
    assert grid[date]["afternoon"]["member"] == [mid]


def test_assignments_ignore_member_ids_from_another_account(client, register, auth):
    token_a, _ = register()
    token_b, _ = register()
    foreign_id = client.post(
        "/api/members",
        headers=auth(token_b),
        json={"last_name": "spy", "first_name": "Eve", "categories": ["member"]},
    ).json()["id"]
    date = day(6)

    saved = client.post(
        "/api/assignments",
        headers=auth(token_a),
        json={date: {"morning": {"member": [foreign_id]}}},
    )
    assert saved.status_code == 200, saved.text
    assert client.get("/api/assignments", headers=auth(token_a)).json() == {}


def test_assignments_are_isolated_per_account(client, register, auth):
    token_a, _ = register()
    token_b, _ = register()
    mid = client.post(
        "/api/members",
        headers=auth(token_a),
        json={"last_name": "mine", "first_name": "Ann", "categories": ["member"]},
    ).json()["id"]
    date = day(7)
    client.post(
        "/api/assignments", headers=auth(token_a), json={date: {"morning": {"member": [mid]}}}
    )

    assert client.get("/api/assignments", headers=auth(token_b)).json() == {}


def test_saving_assignments_requires_admin(client, member_session, auth):
    _, member_token, _ = member_session()
    r = client.post(
        "/api/assignments", headers=auth(member_token), json={day(3): {"morning": {"member": []}}}
    )
    assert r.status_code == 403


def test_submission_drops_past_dates(client, member_session, auth):
    admin_token, member_token, _ = member_session()

    r = client.post(
        "/api/availability-submissions",
        headers=auth(member_token),
        json={
            "dates": json.dumps(
                [
                    {"date": day(-5), "time_slot": "morning"},
                    {"date": day(2), "time_slot": "morning"},
                ]
            ),
        },
    )
    assert r.status_code == 200, r.text

    pending = client.get("/api/availability-submissions", headers=auth(admin_token)).json()
    assert len(pending) == 1
    assert json.loads(pending[0]["dates"]) == [{"date": day(2), "time_slot": "morning"}]


@pytest.mark.parametrize("org_tz, kept", [("Etc/GMT+12", True), ("Etc/GMT-14", False)])
def test_submission_reads_today_in_the_organization_time_zone(
    client, member_session, auth, org_tz, kept
):
    """Today at UTC-12 is always behind today at UTC+14, whatever the server's clock."""
    admin_token, member_token, _ = member_session()
    assert (
        client.post(
            "/api/options", headers=auth(admin_token), json={"timezone": org_tz}
        ).status_code
        == 200
    )

    date_at_utc_minus_12 = today("Etc/GMT+12").isoformat()
    r = client.post(
        "/api/availability-submissions",
        headers=auth(member_token),
        json={
            "dates": json.dumps([{"date": date_at_utc_minus_12, "time_slot": "morning"}]),
        },
    )
    assert r.status_code == 200, r.text
    assert (r.json().get("status") != "no_future_dates") is kept


def test_created_at_is_stored_in_utc(client, member_session, auth):
    admin_token, member_token, _ = member_session()
    client.post(
        "/api/availability-submissions",
        headers=auth(member_token),
        json={"dates": json.dumps([{"date": day(2), "time_slot": "morning"}])},
    )
    pending = client.get("/api/availability-submissions", headers=auth(admin_token)).json()
    created_at = datetime.fromisoformat(pending[0]["created_at"])
    assert abs(datetime.now(timezone.utc) - created_at) < timedelta(minutes=5)


def test_submission_matching_current_assignments_is_not_created(client, member_session, auth):
    admin_token, member_token, member_id = member_session()
    date = day(2)
    client.post(
        "/api/assignments",
        headers=auth(admin_token),
        json={date: {"morning": {"member": [member_id]}}},
    )

    r = client.post(
        "/api/availability-submissions",
        headers=auth(member_token),
        json={"dates": json.dumps([{"date": date, "time_slot": "morning"}])},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "no_changes"
    assert client.get("/api/availability-submissions", headers=auth(admin_token)).json() == []


def test_empty_submission_with_nothing_assigned_is_not_created(client, member_session, auth):
    admin_token, member_token, _ = member_session()
    r = client.post(
        "/api/availability-submissions", headers=auth(member_token), json={"dates": json.dumps([])}
    )
    assert r.json()["status"] == "no_future_dates"
    assert client.get("/api/availability-submissions", headers=auth(admin_token)).json() == []


def test_empty_submission_is_kept_when_it_clears_assignments(client, member_session, auth):
    admin_token, member_token, member_id = member_session()
    client.post(
        "/api/assignments",
        headers=auth(admin_token),
        json={day(2): {"morning": {"member": [member_id]}}},
    )

    r = client.post(
        "/api/availability-submissions", headers=auth(member_token), json={"dates": json.dumps([])}
    )
    assert r.status_code == 200, r.text
    pending = client.get("/api/availability-submissions", headers=auth(admin_token)).json()
    assert len(pending) == 1
    assert json.loads(pending[0]["dates"]) == []


def test_a_new_submission_replaces_the_pending_one(client, member_session, auth):
    admin_token, member_token, _ = member_session()

    client.post(
        "/api/availability-submissions",
        headers=auth(member_token),
        json={"dates": json.dumps([{"date": day(2), "time_slot": "morning"}])},
    )
    client.post(
        "/api/availability-submissions",
        headers=auth(member_token),
        json={
            "dates": json.dumps([{"date": day(3), "time_slot": "afternoon"}]),
            "message": "changed my mind",
        },
    )

    pending = client.get("/api/availability-submissions", headers=auth(admin_token)).json()
    assert len(pending) == 1
    assert json.loads(pending[0]["dates"]) == [{"date": day(3), "time_slot": "afternoon"}]
    assert pending[0]["message"] == "changed my mind"
    assert pending[0]["member"]["first_name"] == "Pat"


def test_my_availability_submission_returns_the_members_own_pending_one(
    client, member_session, auth
):
    _, member_token, _ = member_session()
    assert client.get("/api/my-availability-submission", headers=auth(member_token)).json() is None

    client.post(
        "/api/availability-submissions",
        headers=auth(member_token),
        json={"dates": json.dumps([{"date": day(2), "time_slot": "morning"}])},
    )

    mine = client.get("/api/my-availability-submission", headers=auth(member_token)).json()
    assert json.loads(mine["dates"]) == [{"date": day(2), "time_slot": "morning"}]


def test_validating_a_submission_adds_and_removes_assignments(client, member_session, auth):
    admin_token, member_token, member_id = member_session()
    h = auth(admin_token)
    kept, dropped, added = day(2), day(3), day(4)

    client.post(
        "/api/assignments",
        headers=h,
        json={
            kept: {"morning": {"member": [member_id]}},
            dropped: {"morning": {"member": [member_id]}},
        },
    )

    client.post(
        "/api/availability-submissions",
        headers=auth(member_token),
        json={
            "dates": json.dumps(
                [
                    {"date": kept, "time_slot": "morning"},
                    {"date": added, "time_slot": "afternoon"},
                ]
            ),
        },
    )
    submission_id = client.get("/api/availability-submissions", headers=h).json()[0]["id"]

    validated = client.put(f"/api/availability-submissions/{submission_id}/validate", headers=h)
    assert validated.status_code == 200, validated.text
    assert validated.json() == {
        "status": "validated",
        "assignments_added": 1,
        "assignments_removed": 1,
    }

    grid = client.get("/api/assignments", headers=h).json()
    assert grid[kept]["morning"]["member"] == [member_id]
    assert grid[added]["afternoon"]["member"] == [member_id]
    assert dropped not in grid

    assert client.get("/api/availability-submissions", headers=h).json() == []


def test_a_submission_whose_dates_have_all_passed_is_deleted(
    client, member_session, auth, submissions_table
):
    admin_token, _, member_id = member_session()
    submission_id = submissions_table.store(member_id, [{"date": day(-3), "time_slot": "morning"}])

    assert client.get("/api/availability-submissions", headers=auth(admin_token)).json() == []
    assert submissions_table.dates_of(submission_id) is None


def test_expired_dates_are_stripped_from_a_submission(
    client, member_session, auth, submissions_table
):
    admin_token, _, member_id = member_session()
    still_valid = {"date": day(4), "time_slot": "afternoon"}
    submission_id = submissions_table.store(
        member_id, [{"date": day(-3), "time_slot": "morning"}, still_valid]
    )

    listed = client.get("/api/availability-submissions", headers=auth(admin_token)).json()
    assert len(listed) == 1
    assert json.loads(listed[0]["dates"]) == [still_valid]

    assert submissions_table.dates_of(submission_id) == [still_valid]


def test_validating_clears_a_month_the_submission_leaves_out(client, member_session, auth):
    admin_token, member_token, member_id = member_session()
    h = auth(admin_token)
    this_month, other_month = day(0), next_month_day()

    client.post(
        "/api/assignments", headers=h, json={other_month: {"morning": {"member": [member_id]}}}
    )

    client.post(
        "/api/availability-submissions",
        headers=auth(member_token),
        json={"dates": json.dumps([{"date": this_month, "time_slot": "morning"}])},
    )
    submission_id = client.get("/api/availability-submissions", headers=h).json()[0]["id"]
    result = client.put(f"/api/availability-submissions/{submission_id}/validate", headers=h).json()

    assert result == {"status": "validated", "assignments_added": 1, "assignments_removed": 1}
    grid = client.get("/api/assignments", headers=h).json()
    assert grid[this_month]["morning"]["member"] == [member_id]
    assert other_month not in grid


def test_validating_ignores_months_that_are_entirely_past(client, member_session, auth):
    admin_token, member_token, member_id = member_session()
    h = auth(admin_token)
    past, future = day(-40), day(3)

    client.post("/api/assignments", headers=h, json={past: {"morning": {"member": [member_id]}}})

    client.post(
        "/api/availability-submissions",
        headers=auth(member_token),
        json={"dates": json.dumps([{"date": future, "time_slot": "morning"}])},
    )
    submission_id = client.get("/api/availability-submissions", headers=h).json()[0]["id"]
    result = client.put(f"/api/availability-submissions/{submission_id}/validate", headers=h).json()

    assert result["assignments_removed"] == 0
    assert client.get("/api/assignments", headers=h).json()[past]["morning"]["member"] == [
        member_id
    ]


def test_validating_never_removes_a_past_assignment_from_a_rebuilt_month(
    client, member_session, auth
):
    first_of_month, last_of_month = month_edges()
    if today().day == 1:
        pytest.skip("the current month holds no past date today")

    admin_token, member_token, member_id = member_session()
    h = auth(admin_token)

    client.post(
        "/api/assignments", headers=h, json={first_of_month: {"morning": {"member": [member_id]}}}
    )
    client.post(
        "/api/availability-submissions",
        headers=auth(member_token),
        json={"dates": json.dumps([{"date": last_of_month, "time_slot": "morning"}])},
    )

    submission_id = client.get("/api/availability-submissions", headers=h).json()[0]["id"]
    result = client.put(f"/api/availability-submissions/{submission_id}/validate", headers=h).json()

    assert result["assignments_removed"] == 0
    grid = client.get("/api/assignments", headers=h).json()
    assert grid[first_of_month]["morning"]["member"] == [member_id]
    assert grid[last_of_month]["morning"]["member"] == [member_id]


def test_changing_the_primary_category_moves_future_assignments(client, member_session, auth):
    admin_token, member_token, member_id = member_session()
    h = auth(admin_token)
    past, future, both = day(-3), day(2), day(4)
    client.post(
        "/api/assignments",
        headers=h,
        json={
            past: {"morning": {"member": [member_id]}},
            future: {"morning": {"member": [member_id]}},
            both: {"morning": {"member": [member_id], "driver": [member_id]}},
        },
    )

    member = client.get(f"/api/members/{member_id}", headers=h).json()
    r = client.put(
        f"/api/members/{member_id}", headers=h, json={**member, "categories": ["driver"]}
    )
    assert r.status_code == 200, r.text

    grid = client.get("/api/assignments", headers=h).json()
    assert grid[past]["morning"] == {"member": [member_id]}
    assert grid[future]["morning"] == {"driver": [member_id]}
    assert grid[both]["morning"] == {"driver": [member_id]}

    r = client.post(
        "/api/availability-submissions",
        headers=auth(member_token),
        json={
            "dates": json.dumps(
                [{"date": future, "time_slot": "morning"}, {"date": both, "time_slot": "morning"}]
            )
        },
    )
    assert r.json()["status"] == "no_changes"


def test_ignoring_a_submission_leaves_the_assignments_alone(client, member_session, auth):
    admin_token, member_token, member_id = member_session()
    h = auth(admin_token)
    date = day(2)
    client.post("/api/assignments", headers=h, json={date: {"morning": {"member": [member_id]}}})

    client.post(
        "/api/availability-submissions",
        headers=auth(member_token),
        json={"dates": json.dumps([{"date": day(6), "time_slot": "afternoon"}])},
    )
    submission_id = client.get("/api/availability-submissions", headers=h).json()[0]["id"]

    assert (
        client.delete(f"/api/availability-submissions/{submission_id}", headers=h).status_code
        == 200
    )
    assert client.get("/api/availability-submissions", headers=h).json() == []
    assert client.get("/api/assignments", headers=h).json()[date]["morning"]["member"] == [
        member_id
    ]


def _set_calendar(client, h, member_id, slots):
    member = client.get(f"/api/members/{member_id}", headers=h).json()
    r = client.put(
        f"/api/members/{member_id}",
        headers=h,
        json={**member, "availability_calendar": json.dumps(slots)},
    )
    assert r.status_code == 200, r.text


def _calendar(client, h, member_id):
    member = client.get(f"/api/members/{member_id}", headers=h).json()
    return json.loads(member["availability_calendar"] or "[]")


def test_ignoring_a_submission_realigns_the_calendar_on_the_schedule(client, member_session, auth):
    admin_token, member_token, member_id = member_session()
    h = auth(admin_token)
    past = {"date": day(-3), "time_slot": "morning"}
    scheduled = {"date": day(2), "time_slot": "morning"}
    client.post(
        "/api/assignments",
        headers=h,
        json={scheduled["date"]: {"morning": {"member": [member_id]}}},
    )

    wanted = [past, {"date": day(6), "time_slot": "afternoon"}]
    _set_calendar(client, h, member_id, wanted)
    client.post(
        "/api/availability-submissions",
        headers=auth(member_token),
        json={"dates": json.dumps(wanted)},
    )
    submission_id = client.get("/api/availability-submissions", headers=h).json()[0]["id"]

    assert (
        client.delete(f"/api/availability-submissions/{submission_id}", headers=h).status_code
        == 200
    )

    assert _calendar(client, h, member_id) == [past, scheduled]


def test_an_expired_submission_realigns_the_calendar_on_the_schedule(
    client, member_session, auth, submissions_table
):
    admin_token, _, member_id = member_session()
    h = auth(admin_token)
    expired = {"date": day(-3), "time_slot": "morning"}
    _set_calendar(client, h, member_id, [expired, {"date": day(5), "time_slot": "morning"}])
    submissions_table.store(member_id, [expired])

    assert client.get("/api/availability-submissions", headers=h).json() == []
    assert _calendar(client, h, member_id) == [expired]


def test_submissions_are_isolated_per_account(client, member_session, register, auth):
    admin_token, member_token, _ = member_session()
    other_token, _ = register()

    client.post(
        "/api/availability-submissions",
        headers=auth(member_token),
        json={"dates": json.dumps([{"date": day(2), "time_slot": "morning"}])},
    )
    submission_id = client.get("/api/availability-submissions", headers=auth(admin_token)).json()[
        0
    ]["id"]

    other = auth(other_token)
    assert client.get("/api/availability-submissions", headers=other).json() == []
    assert (
        client.put(
            f"/api/availability-submissions/{submission_id}/validate", headers=other
        ).status_code
        == 404
    )
    assert (
        client.delete(f"/api/availability-submissions/{submission_id}", headers=other).status_code
        == 404
    )


def test_listing_and_validating_submissions_requires_admin(client, member_session, auth):
    _, member_token, _ = member_session()
    h = auth(member_token)
    assert client.get("/api/availability-submissions", headers=h).status_code == 403
    assert client.put("/api/availability-submissions/1/validate", headers=h).status_code == 403
    assert client.delete("/api/availability-submissions/1", headers=h).status_code == 403


def test_submission_requires_a_linked_member_record(client, register, auth):
    token, _ = register()
    r = client.post(
        "/api/availability-submissions",
        headers=auth(token),
        json={"dates": json.dumps([{"date": day(2), "time_slot": "morning"}])},
    )
    assert r.status_code == 404


def test_submission_rejects_malformed_dates(client, member_session, auth):
    _, member_token, _ = member_session()
    r = client.post(
        "/api/availability-submissions", headers=auth(member_token), json={"dates": "not json"}
    )
    assert r.status_code == 400


def test_two_members_cannot_share_an_email(client, register, auth):
    token, _ = register()
    h = auth(token)
    member = {
        "last_name": "one",
        "first_name": "Ann",
        "categories": ["member"],
        "email": "Same@x.test",
    }
    first = client.post("/api/members", headers=h, json=member).json()

    assert (
        client.post("/api/members", headers=h, json={**member, "email": "same@X.test"}).status_code
        == 400
    )
    assert (
        client.put(
            f"/api/members/{first['id']}", headers=h, json={**member, "phone": "1"}
        ).status_code
        == 200
    )

    other = client.post("/api/members", headers=h, json={**member, "email": ""}).json()
    assert client.post("/api/members", headers=h, json={**member, "email": ""}).status_code == 200
    assert client.put(f"/api/members/{other['id']}", headers=h, json=member).status_code == 400

    other_org, _ = register()
    assert client.post("/api/members", headers=auth(other_org), json=member).status_code == 200


def test_a_member_cannot_change_their_own_email(client, member_session, auth):
    _, member_token, member_id = member_session()
    h = auth(member_token)
    me = client.get(f"/api/members/{member_id}", headers=h).json()

    r = client.put(f"/api/members/{member_id}", headers=h,
                   json={**me, "email": "someone-else@example.test", "phone": "0102",
                         "first_name": "patricia", "categories": ["lead"]})
    assert r.status_code == 200, r.text
    assert r.json()["email"] == me["email"]
    assert r.json()["phone"] == "0102"
    assert r.json()["first_name"] == "Patricia"
    assert r.json()["categories"] == me["categories"]
    assert client.put("/api/auth/update-info", headers=h, json={"email": "x@example.test"}).status_code in (404, 405)


@pytest.fixture
def group_emails(monkeypatch):
    import routers.mailing as mailing_router

    calls = []

    def _capture(recipients, subject, message, org_name, reply_to, lang):
        calls.append({"recipients": recipients, "subject": subject, "reply_to": reply_to})
        return len(recipients), 0

    monkeypatch.setattr(mailing_router, "send_group_email", _capture)
    return calls


def _add_member(client, headers, first_name, categories, email=""):
    r = client.post(
        "/api/members",
        headers=headers,
        json={"last_name": "x", "first_name": first_name, "categories": categories, "email": email},
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_group_email_preview_renders_the_sanitized_message(client, register, auth):
    token, _ = register(org_name="Club & co")
    r = client.post(
        "/api/mailing/preview",
        headers=auth(token),
        json={"subject": "News", "message": "<b>Hi</b><script>x()</script>"},
    )
    assert r.status_code == 200, r.text
    html = r.json()["html"]
    assert "<b>Hi</b>" in html and "<script" not in html
    assert "Club &amp; co</span>" in html


def test_group_email_only_reaches_the_admins_active_members(
    client, register, auth, unique_email, group_emails
):
    token, admin_email = register()
    other_token, _ = register()
    h = auth(token)
    mine = _add_member(client, h, "Ann", ["member"], unique_email)
    resigned = _add_member(client, h, "Res", ["member"], "pytest-res@example.test")
    client.put(f"/api/members/{resigned}/resign", headers=h)
    foreign = _add_member(client, auth(other_token), "Eve", ["member"], "pytest-eve@example.test")

    r = client.post(
        "/api/mailing/send",
        headers=h,
        json={"subject": "Hello\nBcc: x", "message": "<p>Hi</p>", "member_ids": [mine, resigned, foreign]},
    )
    assert r.status_code == 200, r.text
    assert r.json() == {"sent": 1, "failed": 0, "skipped": 2}
    assert group_emails == [
        {"recipients": [unique_email], "subject": "Hello Bcc: x", "reply_to": admin_email}
    ]

    empty = client.post(
        "/api/mailing/send", headers=h, json={"subject": "S", "message": "<b> </b>", "member_ids": [mine]}
    )
    assert empty.status_code == 400
    nobody = client.post(
        "/api/mailing/send", headers=h, json={"subject": "S", "message": "Hi", "member_ids": [foreign]}
    )
    assert nobody.status_code == 400


def test_group_email_requires_admin(client, member_session, auth):
    _, member_token, member_id = member_session()
    r = client.post(
        "/api/mailing/send",
        headers=auth(member_token),
        json={"subject": "S", "message": "Hi", "member_ids": [member_id]},
    )
    assert r.status_code == 403
    assert client.post("/api/mailing/preview", headers=auth(member_token), json={}).status_code == 403
