from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from models import Option

DEFAULT_TIMEZONE = "Europe/Paris"


async def get_option(session: AsyncSession, account_id: int, key: str) -> str | None:
    return await session.scalar(
        select(Option.value).where(Option.account_id == account_id, Option.key == key)
    )


async def set_option(session: AsyncSession, account_id: int, key: str, value: str) -> None:
    await session.execute(
        insert(Option)
        .values(account_id=account_id, key=key, value=value)
        .on_conflict_do_update(index_elements=["account_id", "key"], set_={"value": value})
    )


def valid_timezone(name: str) -> bool:
    try:
        ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return False
    return True


async def org_today(session: AsyncSession, account_id: int) -> str:
    """Today as "YYYY-MM-DD" in the organization's time zone."""
    name = await get_option(session, account_id, "timezone")
    tz = ZoneInfo(name if name and valid_timezone(name) else DEFAULT_TIMEZONE)
    return datetime.now(tz).date().isoformat()
