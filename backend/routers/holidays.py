"""Closed and forced-open dates (/api/holidays)."""

import datetime
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.options import get_option, set_option
from core.security import get_account_id, get_current_user, require_admin
from db import SessionDep
from models import Holiday
from schemas import HolidayRequest

router = APIRouter(prefix="/api")

# 0 = Sunday.
DEFAULT_CLOSED_WEEKDAYS = [0, 6]


@router.get("/holidays")
async def get_holidays(
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = SessionDep,
):
    dates = await session.scalars(
        select(Holiday.date).where(Holiday.account_id == get_account_id(current_user))
    )
    return list(dates)


async def _get_open_days(session: AsyncSession, account_id: int) -> list:
    value = await get_option(session, account_id, "open_days")
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []


async def _set_open_days(session: AsyncSession, account_id: int, dates: list) -> None:
    await set_option(session, account_id, "open_days", json.dumps(sorted(set(dates))))


async def _get_closed_weekdays(session: AsyncSession, account_id: int) -> list:
    """`[]` means never closed. Only a missing or bad value falls back."""
    value = await get_option(session, account_id, "closed_days")
    if value:
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return [n for n in parsed if isinstance(n, int)]
        except ValueError:
            pass
    return DEFAULT_CLOSED_WEEKDAYS


def _weekday(date: str) -> int:
    """0 = Sunday, as in the frontend."""
    return (datetime.date.fromisoformat(date).weekday() + 1) % 7


async def _find_holiday(session: AsyncSession, account_id: int, date: str) -> Holiday | None:
    return await session.scalar(
        select(Holiday).where(Holiday.account_id == account_id, Holiday.date == date)
    )


@router.post("/holidays/toggle")
async def toggle_day(
    data: HolidayRequest,
    current_user: dict = Depends(require_admin),
    session: AsyncSession = SessionDep,
):
    """Flip one date. An exception is stored only when it differs from the weekly grid."""
    date = (data.date or "").strip()
    if not date:
        raise HTTPException(status_code=400, detail="Missing date")
    try:
        weekday = _weekday(date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date (expected YYYY-MM-DD)") from None

    account_id = get_account_id(current_user)
    closed_weekdays = await _get_closed_weekdays(session, account_id)
    open_days = await _get_open_days(session, account_id)
    holiday = await _find_holiday(session, account_id, date)

    open_by_grid = weekday not in closed_weekdays
    # Same precedence as the frontend's isDayOpen().
    if date in open_days:
        currently_open = True
    elif holiday:
        currently_open = False
    else:
        currently_open = open_by_grid
    wanted_open = not currently_open

    if holiday:
        await session.delete(holiday)
    next_open_days = [d for d in open_days if d != date]

    if wanted_open != open_by_grid:
        if wanted_open:
            next_open_days.append(date)
        else:
            session.add(Holiday(account_id=account_id, date=date))

    if set(next_open_days) != set(open_days):
        await _set_open_days(session, account_id, next_open_days)

    return {"date": date, "is_open": wanted_open}
