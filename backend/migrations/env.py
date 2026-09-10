import asyncio

from alembic import context

from app.core.config import Settings
from app.db.session import open_database
from app.models.base import Base
from app.models.entry import Actor, Event, LoginSession  # noqa: F401
from app.models.idempotency import IdempotencyRecord  # noqa: F401
from app.models.reports import (  # noqa: F401
    Analysis,
    Participation,
    Report,
    ReportLog,
    SupportRequest,
)


def migrate(connection):
    context.configure(
        connection=connection, target_metadata=Base.metadata, render_as_batch=True
    )
    with context.begin_transaction():
        context.run_migrations()


async def online():
    async with open_database(Settings()) as database:
        async with database.engine.connect() as connection:
            await connection.run_sync(migrate)


if context.is_offline_mode():
    raise RuntimeError("실제 DB 연결을 사용하는 마이그레이션만 지원합니다.")
else:
    asyncio.run(online())
