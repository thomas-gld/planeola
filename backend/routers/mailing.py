from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.limiter import limiter
from core.logging import logger
from core.options import get_option
from core.rich_text import rich_text_to_plain, sanitize_rich_text
from core.security import get_account_id, require_admin
from db import SessionDep
from email_service import render_group_email, request_language, send_group_email
from models import Login, Member
from schemas import GroupEmailPreview, GroupEmailSend

router = APIRouter(prefix="/api")

MAX_SUBJECT = 200
MAX_MESSAGE = 50_000


async def _active_members(session: AsyncSession, account_id: int) -> list[Member]:
    return list(
        await session.scalars(
            select(Member).where(Member.account_id == account_id, Member.resigned.is_(False))
        )
    )


def _check_content(subject: str, message: str) -> None:
    if len(subject) > MAX_SUBJECT or len(message) > MAX_MESSAGE:
        raise HTTPException(status_code=400, detail="The message is too long")


async def _sender_email(session: AsyncSession, current_user: dict) -> str:
    login = await session.get(Login, current_user["login_id"])
    return login.email if login else current_user.get("sub", "")


@router.post("/mailing/preview")
async def preview_group_email(
    data: GroupEmailPreview,
    current_user: dict = Depends(require_admin),
    lang: str = Depends(request_language),
    session: AsyncSession = SessionDep,
):
    account_id = get_account_id(current_user)
    subject = " ".join(data.subject.split())
    _check_content(subject, data.message)

    _, html_body = render_group_email(
        subject,
        data.message,
        await get_option(session, account_id, "org_name") or "",
        lang,
    )
    return {"html": html_body}


@router.post("/mailing/send")
@limiter.limit("5/minute")
async def send_group(
    request: Request,
    data: GroupEmailSend,
    current_user: dict = Depends(require_admin),
    lang: str = Depends(request_language),
    session: AsyncSession = SessionDep,
):
    account_id = get_account_id(current_user)
    subject = " ".join(data.subject.split())
    _check_content(subject, data.message)
    if not subject or not rich_text_to_plain(sanitize_rich_text(data.message)):
        raise HTTPException(status_code=400, detail="A subject and a message are required")

    wanted = set(data.member_ids)
    members = [
        m
        for m in await _active_members(session, account_id)
        if m.id in wanted and m.email.strip()
    ]
    if not members:
        raise HTTPException(status_code=400, detail="No recipient with an email address")

    sender = await _sender_email(session, current_user)
    sent, failed = await run_in_threadpool(
        send_group_email,
        recipients=[m.email.strip() for m in members],
        subject=subject,
        message=data.message,
        org_name=await get_option(session, account_id, "org_name") or "",
        reply_to=sender,
        lang=lang,
    )
    logger.info(
        f"Group email from login {current_user.get('login_id')} in account {account_id}: "
        f"{sent} sent, {failed} failed"
    )
    return {"sent": sent, "failed": failed, "skipped": len(wanted) - len(members)}
