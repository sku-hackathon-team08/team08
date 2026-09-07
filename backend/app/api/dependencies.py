from collections.abc import AsyncIterator
from typing import cast

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import Database


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    """요청별 세션 제공·종료. 업무 트랜잭션을 자동 commit하지 않음."""
    database = cast(Database, request.app.state.database)
    async with database.sessions() as session:
        yield session
