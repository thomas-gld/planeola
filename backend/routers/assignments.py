"""Assignment endpoints (/api/assignments)."""

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import get_account_id, get_current_user, require_admin
from db import SessionDep
from models import Assignment, Member

router = APIRouter(prefix="/api")


@router.get("/assignments")
async def get_assignments(
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = SessionDep,
):
    """{date: {time_slot: {category: [member_id]}}}."""
    assignments = await session.scalars(
        select(Assignment).where(Assignment.account_id == get_account_id(current_user))
    )

    result: dict = {}
    for a in assignments:
        by_slot = result.setdefault(a.date, {})
        by_category = by_slot.setdefault(a.time_slot, {})
        by_category.setdefault(a.category, []).append(a.member_id)

    return result


@router.post("/assignments")
async def save_assignments(
    data: dict[str, dict[str, dict[str, list[int]]]],
    current_user: dict = Depends(require_admin),
    session: AsyncSession = SessionDep,
):
    """Replace each date/slot/category in `data`. An empty list clears it."""
    account_id = get_account_id(current_user)

    # Ids from another account are dropped.
    known_ids = set(await session.scalars(select(Member.id).where(Member.account_id == account_id)))

    for date, slots in data.items():
        for time_slot, categories in slots.items():
            for category, member_ids in categories.items():
                match = (
                    Assignment.account_id == account_id,
                    Assignment.date == date,
                    Assignment.time_slot == time_slot,
                    Assignment.category == category,
                )
                await session.execute(delete(Assignment).where(*match))

                for member_id in {i for i in member_ids if i in known_ids}:
                    session.add(
                        Assignment(
                            account_id=account_id,
                            date=date,
                            time_slot=time_slot,
                            category=category,
                            member_id=member_id,
                        )
                    )
                # Delete before insert.
                await session.flush()

    return {"status": "ok"}
