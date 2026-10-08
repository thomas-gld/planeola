from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.logging import logger
from core.options import get_option
from core.security import get_account_id, get_current_user, require_admin
from db import SessionDep
from email_service import send_invitation_email, send_notes_notification_email
from models import Invitation, Login, User, UserRole
from models import Member as MemberRow
from schemas import Member

router = APIRouter(prefix="/api")

MEMBER_PUBLIC_FIELDS = {"id", "last_name", "first_name", "categories", "resigned"}
# Not email: it is how invitations and the login are matched.
MEMBER_SELF_EDITABLE = {
    "first_name",
    "last_name",
    "phone",
    "availability_notes",
    "availability_calendar",
}


async def _find_login(session: AsyncSession, email: str) -> Login | None:
    return await session.scalar(select(Login).where(func.lower(Login.email) == email.lower()))


async def _deliver_invitation(session: AsyncSession, member: MemberRow, invitation) -> bool:
    # has_account is looked up at send time: the person may have signed up since.
    # In a thread, not in the background: the admin is told whether it went out.
    return await run_in_threadpool(
        send_invitation_email,
        recipient_email=invitation.email,
        recipient_name=f"{member.first_name} {member.last_name}".strip(),
        org_name=await get_option(session, member.account_id, "org_name") or "",
        inviter_email=invitation.invited_by_email,
        has_account=await _find_login(session, invitation.email) is not None,
    )


async def _find_member(session: AsyncSession, member_id: int, current_user: dict) -> MemberRow:
    member = await session.get(MemberRow, member_id)
    if not member or member.account_id != current_user.get("account_id"):
        raise HTTPException(status_code=404, detail="Member not found")
    return member


async def _find_invitation(session: AsyncSession, member_id: int) -> Invitation:
    invitation = await session.scalar(select(Invitation).where(Invitation.member_id == member_id))
    if not invitation:
        raise HTTPException(status_code=404, detail="No pending invitation for this member")
    return invitation


def _public(member: MemberRow) -> dict:
    return {k: v for k, v in member.to_dict().items() if k in MEMBER_PUBLIC_FIELDS}


async def _check_email_free(
    session: AsyncSession, account_id: int, email: str, member_id: int | None = None
) -> None:
    """One member per email in an organization. An empty email is always allowed."""
    email = email.strip()
    if not email:
        return
    query = select(MemberRow.id).where(
        MemberRow.account_id == account_id, func.lower(MemberRow.email) == email.lower()
    )
    if member_id is not None:
        query = query.where(MemberRow.id != member_id)
    if await session.scalar(query.limit(1)):
        raise HTTPException(
            status_code=400, detail="Another member of this organization already uses this email"
        )


def _member_fields(data: Member) -> dict:
    """Formatted names, without the non-column previous_availability_notes."""
    fields = data.model_dump(exclude={"previous_availability_notes"})
    fields["last_name"] = fields["last_name"].upper()
    fields["first_name"] = fields["first_name"].capitalize()
    return fields


@router.get("/members")
async def list_members(
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = SessionDep,
):
    account_id = get_account_id(current_user)
    members = (
        await session.scalars(select(MemberRow).where(MemberRow.account_id == account_id))
    ).all()

    if current_user.get("role") == "admin":
        pending_member_ids = set(
            await session.scalars(
                select(Invitation.member_id).where(Invitation.account_id == account_id)
            )
        )
        return [
            {
                **m.to_dict(),
                "invite_status": "accepted"
                if m.user_id
                else ("pending" if m.id in pending_member_ids else "none"),
            }
            for m in members
        ]

    user_id = current_user.get("user_id")
    return [m.to_dict() if m.user_id == user_id else _public(m) for m in members]


@router.get("/members/{member_id}")
async def get_member(
    member_id: int,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = SessionDep,
):
    member = await _find_member(session, member_id, current_user)
    if current_user.get("role") == "admin" or member.user_id == current_user.get("user_id"):
        return member.to_dict()
    return _public(member)


@router.post("/members")
async def create_member(
    data: Member,
    current_user: dict = Depends(require_admin),
    session: AsyncSession = SessionDep,
):
    account_id = get_account_id(current_user)
    await _check_email_free(session, account_id, data.email)
    created = MemberRow(**_member_fields(data), account_id=account_id)
    session.add(created)
    await session.flush()
    return created.to_dict()


@router.put("/members/{member_id}")
async def update_member(
    member_id: int,
    data: Member,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = SessionDep,
):
    member = await _find_member(session, member_id, current_user)

    is_admin = current_user.get("role") == "admin"
    if not is_admin and member.user_id != current_user.get("user_id"):
        raise HTTPException(status_code=403, detail="Action not allowed")

    update_data = _member_fields(data)
    if not is_admin:
        update_data = {k: v for k, v in update_data.items() if k in MEMBER_SELF_EDITABLE}
    await _check_email_free(session, member.account_id, data.email, member.id)

    for field, value in update_data.items():
        setattr(member, field, value)
    # The linked membership's display name follows the member's.
    user = await session.get(User, member.user_id) if member.user_id else None
    if user:
        user.name = user.fullname = f"{member.first_name} {member.last_name}".strip()
    await session.flush()

    # Only sent when the notes changed.
    if data.previous_availability_notes is not None:
        manager_email = await get_option(session, member.account_id, "manager_email")
        if manager_email:
            background_tasks.add_task(
                send_notes_notification_email,
                recipient_email=manager_email,
                member_name=f"{member.first_name} {member.last_name}",
                old_notes=data.previous_availability_notes,
                new_notes=member.availability_notes,
            )
        else:
            logger.warning(f"No manager_email: notes change of member {member_id} not sent")

    return member.to_dict()


async def _set_resigned(session: AsyncSession, member_id: int, current_user: dict, resigned: bool):
    member = await _find_member(session, member_id, current_user)
    member.resigned = resigned
    await session.flush()
    return {"status": "ok", "member": member.to_dict()}


@router.put("/members/{member_id}/resign")
async def resign_member(
    member_id: int,
    current_user: dict = Depends(require_admin),
    session: AsyncSession = SessionDep,
):
    return await _set_resigned(session, member_id, current_user, True)


@router.put("/members/{member_id}/reinstate")
async def reinstate_member(
    member_id: int,
    current_user: dict = Depends(require_admin),
    session: AsyncSession = SessionDep,
):
    return await _set_resigned(session, member_id, current_user, False)


@router.delete("/members/{member_id}")
async def delete_member(
    member_id: int,
    current_user: dict = Depends(require_admin),
    session: AsyncSession = SessionDep,
):
    member = await _find_member(session, member_id, current_user)

    # Drop the Login too once it has no membership left, freeing the email.
    linked_user = await session.get(User, member.user_id) if member.user_id else None
    if linked_user:
        login_id = linked_user.login_id
        await session.delete(linked_user)
        await session.flush()
        if not await session.scalar(select(User.id).where(User.login_id == login_id).limit(1)):
            await session.delete(await session.get(Login, login_id))

    logger.warning(
        f"Member {member_id} permanently deleted from account {member.account_id} "
        f"| by login {current_user.get('login_id')}"
    )
    await session.delete(member)
    return {"status": "deleted"}


@router.post("/members/{member_id}/create-account")
async def invite_member(
    member_id: int,
    current_user: dict = Depends(require_admin),
    session: AsyncSession = SessionDep,
):

    member = await _find_member(session, member_id, current_user)

    if member.user_id:
        raise HTTPException(status_code=400, detail="This member already has a user account")

    if await session.scalar(select(Invitation.id).where(Invitation.member_id == member_id)):
        raise HTTPException(
            status_code=400, detail="An invitation is already pending for this member"
        )

    email = (member.email or "").strip()
    if not email:
        raise HTTPException(
            status_code=400,
            detail="The member must have an email address before an invitation can be sent",
        )

    fullname = f"{member.first_name} {member.last_name}".strip()
    login_row = await _find_login(session, email)
    if login_row:
        roles = set(
            await session.scalars(
                select(User.role).where(
                    User.login_id == login_row.id, User.account_id == member.account_id
                )
            )
        )

        if UserRole.member in roles:
            raise HTTPException(
                status_code=400,
                detail="A user account with this email already exists in this organization",
            )
        # Already in the organization (Admin): linked without an invitation.
        if roles:
            user = User(
                account_id=member.account_id,
                login_id=login_row.id,
                name=fullname,
                fullname=fullname,
                role=UserRole.member,
            )
            session.add(user)
            await session.flush()
            member.user_id = user.id
            return {"status": "linked", "name": fullname, "email": email, "email_sent": False}

    admin_login = await session.get(Login, current_user["login_id"])
    inviter_email = admin_login.email if admin_login else current_user.get("sub", "")

    invitation = Invitation(
        account_id=member.account_id,
        member_id=member_id,
        email=email,
        role=UserRole.member,
        invited_by_email=inviter_email,
    )
    session.add(invitation)
    await session.flush()

    return {
        "status": "invited",
        "invitation_id": invitation.id,
        "name": fullname,
        "email": email,
        "email_sent": await _deliver_invitation(session, member, invitation),
    }


@router.post("/members/{member_id}/invitation/resend")
async def resend_invitation(
    member_id: int,
    current_user: dict = Depends(require_admin),
    session: AsyncSession = SessionDep,
):
    member = await _find_member(session, member_id, current_user)
    invitation = await _find_invitation(session, member_id)
    email_sent = await _deliver_invitation(session, member, invitation)
    return {"status": "resent", "email": invitation.email, "email_sent": email_sent}


@router.delete("/members/{member_id}/invitation")
async def cancel_invitation(
    member_id: int,
    current_user: dict = Depends(require_admin),
    session: AsyncSession = SessionDep,
):
    await _find_member(session, member_id, current_user)
    await session.delete(await _find_invitation(session, member_id))
    return {"status": "cancelled"}
