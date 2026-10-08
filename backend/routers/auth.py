"""Authentication & identity endpoints (/api/auth/*)."""

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.config import APP_URL, ECHO_SECRETS
from core.limiter import limiter
from core.logging import logger
from core.options import get_option, set_option
from core.security import (
    check_new_password,
    create_access_token,
    get_current_user,
    hash_password,
    hash_reset_token,
    verify_password,
)
from db import SessionDep
from email_service import send_password_reset_email, send_verification_code_email
from models import Account, Invitation, Login, Option, User, UserRole, as_utc
from schemas import (
    ChangePasswordRequest,
    CreateOrganizationRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResendCodeRequest,
    ResetPasswordRequest,
    SetDefaultAccountRequest,
    SwitchAccountRequest,
    TokenResponse,
    VerifyEmailRequest,
)

router = APIRouter(prefix="/api")

VERIFICATION_CODE_TTL_MINUTES = 15
PASSWORD_RESET_TTL_MINUTES = 30
# Wrong tries before a new code is needed.
VERIFICATION_MAX_ATTEMPTS = 5


async def _find_login(session: AsyncSession, email: str) -> Login | None:
    """Case-insensitive."""
    return await session.scalar(
        select(Login).where(func.lower(Login.email) == (email or "").strip().lower())
    )


async def _list_memberships(session: AsyncSession, login_id: int) -> list:
    """The person's memberships, minus resigned ones."""
    users = (
        await session.scalars(
            select(User)
            .where(User.login_id == login_id)
            .options(selectinload(User.account), selectinload(User.member))
        )
    ).all()
    active = [u for u in users if not (u.member and u.member.resigned)]

    # org_name option wins over Account.name.
    rows = await session.execute(
        select(Option.account_id, Option.value).where(
            Option.account_id.in_({u.account_id for u in active}), Option.key == "org_name"
        )
    )
    configured: dict[int, str] = dict(rows.tuples().all())

    return [
        {
            "account_id": u.account_id,
            "account_name": configured.get(u.account_id, "").strip() or u.account.name,
            "role": u.role,
            "user_id": u.id,
            "fullname": u.fullname,
            "name": u.name,
        }
        for u in active
    ]


def _account_choices(memberships: list) -> list:
    return [
        {
            "account_id": m["account_id"],
            "user_id": m["user_id"],
            "name": m["account_name"],
            "role": m["role"],
        }
        for m in memberships
    ]


def _session_token(user: User, login_id: int) -> str:
    """Access token for one membership."""
    return create_access_token(
        data={
            "sub": user.name,
            "user_id": user.id,
            "login_id": login_id,
            "role": user.role,
            "fullname": user.fullname,
            "account_id": user.account_id,
        }
    )


async def _issue_verification_code(
    session: AsyncSession, login: Login, background_tasks: BackgroundTasks
) -> None:
    """New code, stored hashed, emailed."""
    code = f"{secrets.randbelow(1_000_000):06d}"
    login.verification_code = hash_password(code)
    login.verification_expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(
        minutes=VERIFICATION_CODE_TTL_MINUTES
    )
    login.verification_attempts = 0
    await session.flush()

    if ECHO_SECRETS:
        print(f"🔑 Verification code for {login.email}: {code}", flush=True)
    background_tasks.add_task(send_verification_code_email, recipient_email=login.email, code=code)


async def _provision_account(
    session: AsyncSession, login_id: int, email: str, org_name: str
) -> User:
    """New Account with its admin User and default Options."""
    account = Account(name=org_name or email)
    session.add(account)
    await session.flush()

    user = User(
        account_id=account.id,
        login_id=login_id,
        name=email,
        fullname=org_name or email,
        role=UserRole.admin,
    )
    session.add(user)
    await session.flush()

    # closed_days: 0 = Sunday.
    default_options = {
        "org_name": org_name,
        "manager_email": email,
        "closed_days": "[0, 6]",
        "time_slots": '[{"key": "morning", "label": "Morning", "color": "#2563eb"}, {"key": "afternoon", "label": "Afternoon", "color": "#16a34a"}]',
    }
    for key, value in default_options.items():
        await set_option(session, account.id, key, value)

    return user


async def _identity_session(session: AsyncSession, login: Login) -> dict:
    """An access token if the organization is known, else a select_token and the choices."""
    memberships = await _list_memberships(session, login.id)
    if not memberships:
        access_token = create_access_token(data={"sub": login.email, "login_id": login.id})
        return {"access_token": access_token, "token_type": "bearer", "accounts": []}

    is_member = any(m["user_id"] == login.default_user_id for m in memberships)
    default = await session.get(User, login.default_user_id) if is_member else None
    if default:
        return {
            "access_token": _session_token(default, login.id),
            "token_type": "bearer",
            "accounts": [],
        }

    select_token = create_access_token(
        data={"sub": login.email, "login_id": login.id, "scope": "select"},
        expires_minutes=30,
    )
    return {"select_token": select_token, "accounts": _account_choices(memberships)}


@router.post("/auth/login")
@limiter.limit("5/minute")
async def login(
    request: Request,
    credentials: LoginRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = SessionDep,
):
    email = credentials.email.strip()
    login_row = await _find_login(session, email)

    client_ip = request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or (
        request.client.host if request.client else "unknown"
    )
    if not login_row or not verify_password(credentials.password, login_row.password):
        logger.warning(f"Login failed for '{email}' | IP={client_ip}")
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    # Unconfirmed registration: a new code, no session.
    if not login_row.email_verified:
        await _issue_verification_code(session, login_row, background_tasks)
        logger.info(f"Login blocked pending email verification: {email} | IP={client_ip}")
        return {"status": "verification_required", "email": login_row.email}

    result = await _identity_session(session, login_row)
    logger.info(
        f"Login successful: {email} | {len(result.get('accounts', []))} org(s) | IP={client_ip}"
    )
    return result


@router.post("/auth/switch-account", response_model=TokenResponse)
async def switch_account(
    data: SwitchAccountRequest,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = SessionDep,
):
    """By user_id, not account_id: one login can hold two roles in one organization."""
    login_id = current_user.get("login_id")
    if not login_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await session.scalar(
        select(User)
        .where(User.id == data.user_id, User.login_id == login_id)
        .options(selectinload(User.member))
    )
    if not user:
        raise HTTPException(status_code=404, detail="You are not a member of this organization")

    if user.member and user.member.resigned:
        raise HTTPException(status_code=403, detail="Your account has been disabled")

    return {"access_token": _session_token(user, login_id), "token_type": "bearer"}


@router.get("/auth/my-accounts")
async def get_my_accounts(
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = SessionDep,
):
    """One entry per membership, for the switcher."""
    login_id = current_user.get("login_id")
    if not login_id:
        return {
            "accounts": [],
            "current_account_id": current_user.get("account_id"),
            "current_user_id": current_user.get("user_id"),
            "default_user_id": None,
            "email": None,
        }
    login_row = await session.get(Login, login_id)
    memberships = await _list_memberships(session, login_id)
    return {
        "accounts": _account_choices(memberships),
        "current_account_id": current_user.get("account_id"),
        "current_user_id": current_user.get("user_id"),
        "default_user_id": login_row.default_user_id if login_row else None,
        "email": login_row.email if login_row else None,
    }


@router.put("/auth/default-account")
async def set_default_account(
    data: SetDefaultAccountRequest,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = SessionDep,
):
    """Membership opened at login. Null clears it."""
    login_id = current_user.get("login_id")
    login_row = await session.get(Login, login_id) if login_id else None
    if not login_row:
        raise HTTPException(status_code=401, detail="Invalid token")

    if data.user_id is not None:
        user = await session.scalar(
            select(User).where(User.id == data.user_id, User.login_id == login_id)
        )
        if not user:
            raise HTTPException(status_code=404, detail="You are not a member of this organization")

    login_row.default_user_id = data.user_id
    return {"default_user_id": data.user_id}


@router.get("/auth/pending-invites")
async def get_pending_invites(
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = SessionDep,
):
    """Matched on the Login's email: the person is not in those organizations yet."""
    login_id = current_user.get("login_id")
    login_row = await session.get(Login, login_id) if login_id else None
    if not login_row:
        return {"invites": []}

    invitations = (
        await session.scalars(
            select(Invitation)
            .where(func.lower(Invitation.email) == login_row.email.lower())
            .options(selectinload(Invitation.account))
        )
    ).all()

    invites = []
    for inv in invitations:
        org_name = await get_option(session, inv.account_id, "org_name")
        invites.append(
            {
                "id": inv.id,
                "account_id": inv.account_id,
                "org_name": (org_name or "").strip() or (inv.account.name if inv.account else ""),
                "role": inv.role,
                "invited_by_email": inv.invited_by_email,
            }
        )
    return {"invites": invites}


@router.post("/auth/invites/{invitation_id}/accept", response_model=TokenResponse)
async def accept_invite(
    invitation_id: int,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = SessionDep,
):
    """Creates the membership and returns its token."""
    login_id = current_user.get("login_id")
    login_row = await session.get(Login, login_id) if login_id else None
    if not login_row:
        raise HTTPException(status_code=401, detail="Invalid token")

    invitation = await session.scalar(
        select(Invitation)
        .where(Invitation.id == invitation_id)
        .options(selectinload(Invitation.member))
    )
    if (
        not invitation
        or not invitation.member
        or invitation.email.lower() != login_row.email.lower()
    ):
        raise HTTPException(status_code=404, detail="Invitation not found")

    member = invitation.member
    fullname = f"{member.first_name} {member.last_name}".strip()
    user = User(
        account_id=invitation.account_id,
        login_id=login_row.id,
        name=fullname,
        fullname=fullname,
        role=invitation.role,
    )
    session.add(user)
    await session.flush()

    member.user_id = user.id
    await session.delete(invitation)
    await session.flush()

    return {"access_token": _session_token(user, login_row.id), "token_type": "bearer"}


@router.post("/auth/invites/{invitation_id}/decline")
async def decline_invite(
    invitation_id: int,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = SessionDep,
):
    """The admin can re-invite."""
    login_id = current_user.get("login_id")
    login_row = await session.get(Login, login_id) if login_id else None
    if not login_row:
        raise HTTPException(status_code=401, detail="Invalid token")

    invitation = await session.get(Invitation, invitation_id)
    if not invitation or invitation.email.lower() != login_row.email.lower():
        raise HTTPException(status_code=404, detail="Invitation not found")

    await session.delete(invitation)
    return {"status": "declined"}


@router.post("/auth/register")
@limiter.limit("5/minute")
async def register(
    request: Request,
    data: RegisterRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = SessionDep,
):
    """Stores an unverified Login and emails a code, then verify-email finishes.
    A verified email needs its password, an unverified one can be taken over."""
    email = (data.email or "").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address")
    login_row = await _find_login(session, email)

    if login_row and login_row.email_verified:
        if not verify_password(data.password, login_row.password):
            raise HTTPException(
                status_code=400,
                detail="An account already exists with this email address (incorrect password)",
            )
        return await _identity_session(session, login_row)

    check_new_password(data.password, email)
    hashed = hash_password(data.password)
    if login_row:
        login_row.password = hashed
    else:
        login_row = Login(email=email, password=hashed)
        session.add(login_row)
    await session.flush()

    await _issue_verification_code(session, login_row, background_tasks)
    return {"status": "verification_required", "email": email}


@router.post("/auth/verify-email")
@limiter.limit("10/minute")
async def verify_email(
    request: Request,
    data: VerifyEmailRequest,
    session: AsyncSession = SessionDep,
):
    """Confirms the code and logs the person in."""
    email = (data.email or "").strip().lower()
    code = (data.code or "").strip()

    login_row = await _find_login(session, email)
    if not login_row:
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    if login_row.email_verified:
        raise HTTPException(status_code=400, detail="This email address is already verified")

    if not login_row.verification_code or not login_row.verification_expires_at:
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    if datetime.now(timezone.utc) > as_utc(login_row.verification_expires_at):
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    if login_row.verification_attempts >= VERIFICATION_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429, detail="Too many incorrect attempts. Request a new code."
        )

    if not verify_password(code, login_row.verification_code):
        login_row.verification_attempts += 1
        # Saved despite the error.
        await session.commit()
        logger.warning(f"Wrong verification code for {email}")
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    login_row.email_verified = True
    login_row.verification_code = None
    login_row.verification_expires_at = None
    login_row.verification_attempts = 0
    await session.flush()

    return await _identity_session(session, login_row)


@router.post("/auth/resend-code")
@limiter.limit("3/minute")
async def resend_verification_code(
    request: Request,
    data: ResendCodeRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = SessionDep,
):
    """Same answer whether the email exists or not."""
    email = (data.email or "").strip().lower()

    login_row = await _find_login(session, email)
    if login_row and not login_row.email_verified:
        await _issue_verification_code(session, login_row, background_tasks)
    return {"status": "verification_required", "email": email}


@router.post("/auth/create-organization", response_model=TokenResponse)
async def create_organization(
    data: CreateOrganizationRequest,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = SessionDep,
):
    """Creates the organization and switches into it."""
    login_id = current_user.get("login_id")
    if not login_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    org_name = (data.org_name or "").strip()
    if not org_name:
        raise HTTPException(status_code=400, detail="Organization name is required")

    login_row = await session.get(Login, login_id)
    if not login_row:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await _provision_account(session, login_id, login_row.email, org_name)

    return {"access_token": _session_token(user, login_id), "token_type": "bearer"}


@router.post("/auth/verify")
async def verify_auth(current_user: dict = Depends(get_current_user)):
    return {"valid": True, "user": current_user.get("sub")}


@router.post("/auth/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = SessionDep,
):
    login_id = current_user.get("login_id")

    login_row = await session.get(Login, login_id) if login_id else None
    if not login_row:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(data.current_password, login_row.password):
        logger.warning(f"Password change failed for {login_row.email}: current password incorrect")
        raise HTTPException(status_code=400, detail="The current password is incorrect")

    check_new_password(data.new_password, login_row.email)

    login_row.password = hash_password(data.new_password)
    return {"message": "Password changed successfully"}


@router.post("/auth/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(
    data: ForgotPasswordRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    session: AsyncSession = SessionDep,
):
    """Emails a one-time link. The password is untouched, and the answer is the
    same whether the email exists or not."""
    generic_message = (
        "If an account is associated with this email address, a reset link has been sent."
    )

    login_row = await _find_login(session, data.email)
    if not login_row:
        return {"message": generic_message}

    token = secrets.token_urlsafe(32)
    login_row.reset_token = hash_reset_token(token)
    login_row.reset_expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(
        minutes=PASSWORD_RESET_TTL_MINUTES
    )
    await session.flush()

    # Any membership, for a display name.
    membership = await session.scalar(select(User).where(User.login_id == login_row.id))
    recipient_name = membership.fullname if membership and membership.fullname else login_row.email

    reset_url = f"{APP_URL}/reset-password?token={token}"
    if ECHO_SECRETS:
        print(f"\U0001f517 Password reset link for {login_row.email}: {reset_url}", flush=True)
    background_tasks.add_task(
        send_password_reset_email,
        recipient_email=login_row.email,
        recipient_name=recipient_name,
        reset_url=reset_url,
        expires_in_minutes=PASSWORD_RESET_TTL_MINUTES,
    )

    return {"message": generic_message}


@router.post("/auth/reset-password")
@limiter.limit("5/minute")
async def reset_password(
    data: ResetPasswordRequest,
    request: Request,
    session: AsyncSession = SessionDep,
):
    # One message for every failure.
    invalid = HTTPException(status_code=400, detail="This link is invalid or has expired")

    if not data.token:
        raise invalid

    login_row = await session.scalar(
        select(Login).where(Login.reset_token == hash_reset_token(data.token))
    )
    if not login_row or not login_row.reset_expires_at:
        raise invalid
    if datetime.now(timezone.utc) > as_utc(login_row.reset_expires_at):
        raise invalid

    # After the link check, so a bad link always gets the same answer.
    check_new_password(data.new_password, login_row.email)

    login_row.password = hash_password(data.new_password)
    # Single use.
    login_row.reset_token = None
    login_row.reset_expires_at = None
    logger.info(f"Password reset completed for {login_row.email}")
    return {"message": "Password updated successfully"}
