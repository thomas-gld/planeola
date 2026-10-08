from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from core.options import set_option, valid_timezone
from core.security import get_account_id, get_current_user, require_admin
from db import SessionDep
from models import Assignment, Member, Option
from schemas import CategoryRename

router = APIRouter(prefix="/api")


@router.get("/options")
async def get_options(
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = SessionDep,
):
    options = await session.scalars(
        select(Option).where(Option.account_id == get_account_id(current_user))
    )
    return {opt.key: opt.value for opt in options}


@router.post("/options")
async def set_options(
    data: dict[str, str],
    current_user: dict = Depends(require_admin),
    session: AsyncSession = SessionDep,
):
    if "timezone" in data and not valid_timezone(data["timezone"]):
        raise HTTPException(status_code=400, detail="Unknown time zone")

    account_id = get_account_id(current_user)
    for key, value in data.items():
        await set_option(session, account_id, key, value)
    return {"status": "ok"}


@router.post("/categories/rename")
async def rename_category(
    data: CategoryRename,
    current_user: dict = Depends(require_admin),
    session: AsyncSession = SessionDep,
):
    """Rewrites member categories and assignments."""
    old = (data.old_name or "").strip()
    new = (data.new_name or "").strip()
    if not old or not new or old == new:
        return {"members_updated": 0, "assignments_updated": 0}

    account_id = get_account_id(current_user)
    members = (
        await session.scalars(
            select(Member).where(Member.account_id == account_id, Member.categories.contains([old]))
        )
    ).all()
    for member in members:
        member.categories = [new if c == old else c for c in (member.categories or [])]

    # One savepoint per row: a member already assigned under the new name collides.
    ids = (
        await session.scalars(
            select(Assignment.id).where(
                Assignment.account_id == account_id, Assignment.category == old
            )
        )
    ).all()
    assignments_updated = 0
    for assignment_id in ids:
        try:
            async with session.begin_nested():
                await session.execute(
                    update(Assignment).where(Assignment.id == assignment_id).values(category=new)
                )
            assignments_updated += 1
        except IntegrityError:
            pass

    return {"members_updated": len(members), "assignments_updated": assignments_updated}
