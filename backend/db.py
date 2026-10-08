from collections.abc import AsyncIterator

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from core.config import DATABASE_URL

ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
SYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

# Timestamp columns are naive UTC, so CURRENT_TIMESTAMP must be UTC whatever the server's zone.
engine = create_async_engine(
    ASYNC_DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"server_settings": {"timezone": "UTC"}},
)
Session = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    """Commits when the endpoint returns, rolls back if it raises."""
    async with Session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


SessionDep = Depends(get_session, scope="function")
