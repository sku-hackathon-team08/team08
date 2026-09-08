import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import event, text
from sqlalchemy.engine import make_url
from sqlalchemy.engine.interfaces import DBAPIConnection
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import ConnectionPoolEntry

from app.core.config import Settings

logger = logging.getLogger(__name__)


class DatabaseStartupError(RuntimeError):
    """연결 문자열을 노출하지 않는 DB 시작 실패."""


class DatabaseShutdownError(RuntimeError):
    """드라이버의 원본 메시지를 노출하지 않는 DB 정리 실패."""


@dataclass(frozen=True)
class Database:
    engine: AsyncEngine
    sessions: async_sessionmaker[AsyncSession]


def enable_sqlite_foreign_keys(
    connection: DBAPIConnection, record: ConnectionPoolEntry
) -> None:
    cursor = connection.cursor()
    try:
        cursor.execute("PRAGMA foreign_keys=ON")
    finally:
        cursor.close()


@asynccontextmanager
async def open_database(settings: Settings) -> AsyncIterator[Database]:
    engine: AsyncEngine | None = None
    try:
        try:
            url = make_url(settings.database_url.get_secret_value())
            if url.drivername == "sqlite":
                assert url.database is not None
                Path(url.database).parent.mkdir(parents=True, exist_ok=True)
                url = url.set(drivername="sqlite+aiosqlite")
            else:
                url = url.set(drivername="postgresql+psycopg")
            engine = create_async_engine(
                url,
                hide_parameters=True,
                pool_size=settings.database_pool_size,
                max_overflow=settings.database_max_overflow,
                pool_timeout=settings.database_pool_timeout_seconds,
                pool_pre_ping=settings.database_pool_pre_ping,
            )
            if url.drivername == "sqlite+aiosqlite":
                event.listen(engine.sync_engine, "connect", enable_sqlite_foreign_keys)
            async with asyncio.timeout(settings.database_connect_timeout_seconds):
                async with engine.connect() as connection:
                    await connection.execute(text("SELECT 1"))
        except TimeoutError:
            raise DatabaseStartupError(
                "DB 연결 확인 시간이 초과되었습니다. DB 실행 상태와 네트워크를 확인하세요."
            ) from None
        except Exception as error:
            raise DatabaseStartupError(
                f"DB 연결을 시작하지 못했습니다 ({type(error).__name__}). "
                "DATABASE_URL, DB 실행 상태와 파일·접속 권한을 확인하세요."
            ) from None
        database = Database(engine, async_sessionmaker(engine, expire_on_commit=False))
        logger.info("DB 연결 확인 완료 (%s)", url.get_backend_name())
        yield database
    finally:
        if engine is not None:
            try:
                await engine.dispose()
            except Exception as error:
                raise DatabaseShutdownError(
                    f"DB 연결 풀 정리에 실패했습니다 ({type(error).__name__})."
                ) from None
            logger.info("DB 연결 풀 정리 완료")
