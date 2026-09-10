import asyncio
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import func, select

from app.core.config import Settings
from app.db.session import open_database
from app.models.base import Base
from app.models.entry import Event
from app.models.idempotency import IdempotencyRecord
from app.services.errors import ServiceError
from app.services.idempotency import StoredResponse, execute_once, fingerprint


@pytest.mark.anyio
async def test_claim_race_replay_conflict_and_atomic_failure(tmp_path: Path) -> None:
    async with open_database(
        Settings(_env_file=None, database_url=f"sqlite:///{tmp_path}/idem.db")
    ) as database:
        async with database.engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        key = uuid4()
        started, release = asyncio.Event(), asyncio.Event()

        async def operation(db):
            started.set()
            await release.wait()
            db.add(Event(name="행사", code="ONCE", map_id=uuid4()))
            await db.flush()
            return StoredResponse(201, {"ok": True}, {"Location": "/created"})

        first = asyncio.create_task(
            execute_once(
                database.sessions, "actor:path", key, fingerprint({"v": 1}), operation
            )
        )
        await started.wait()
        with pytest.raises(ServiceError, match="REQUEST_IN_PROGRESS"):
            await execute_once(
                database.sessions, "actor:path", key, fingerprint({"v": 1.0}), operation
            )
        with pytest.raises(ServiceError, match="IDEMPOTENCY_CONFLICT"):
            await execute_once(
                database.sessions, "actor:path", key, fingerprint({"v": 2}), operation
            )
        release.set()
        result = await first
        assert (
            await execute_once(
                database.sessions, "actor:path", key, fingerprint({"v": 1}), operation
            )
            == result
        )
        async with database.sessions() as db:
            assert await db.scalar(select(func.count()).select_from(Event)) == 1

        async def fail(db):
            db.add(Event(name="롤백", code="ROLLBACK", map_id=uuid4()))
            await db.flush()
            raise ServiceError(409, "INVALID_REPORT_STATE", "처리할 수 없습니다.")

        failure_key = uuid4()
        failed = await execute_once(
            database.sessions, "actor:path", failure_key, fingerprint({}), fail
        )
        assert failed.status == 409
        assert (
            await execute_once(
                database.sessions, "actor:path", failure_key, fingerprint({}), operation
            )
            == failed
        )
        async with database.sessions() as db:
            assert await db.scalar(select(func.count()).select_from(Event)) == 1

        async def crash(db):
            db.add(Event(name="롤백", code="CRASH", map_id=uuid4()))
            await db.flush()
            raise RuntimeError("private")

        crash_key = uuid4()
        with pytest.raises(RuntimeError):
            await execute_once(
                database.sessions, "actor:path", crash_key, fingerprint({}), crash
            )
        with pytest.raises(ServiceError, match="REQUEST_IN_PROGRESS"):
            await execute_once(
                database.sessions, "actor:path", crash_key, fingerprint({}), operation
            )
        async with database.sessions() as db:
            assert await db.scalar(select(func.count()).select_from(Event)) == 1
            assert (
                await db.scalar(select(func.count()).select_from(IdempotencyRecord))
                == 3
            )


def test_json_fingerprint_preserves_semantics() -> None:
    assert fingerprint({"a": 1, "b": [2.0]}) == fingerprint({"b": [2], "a": 1.0})
    assert fingerprint({"v": True}) != fingerprint({"v": 1})
    assert fingerprint({}) != fingerprint({"v": None})
    assert fingerprint([1, 2]) != fingerprint([2, 1])
    assert fingerprint({"v": "1"}) != fingerprint({"v": 1})


def test_large_decimal_fingerprints_do_not_round_distinct_values():
    from decimal import Decimal

    assert fingerprint(
        {"value": Decimal("123456789012345678901234567890.1")}
    ) != fingerprint({"value": Decimal("123456789012345678901234567890.2")})
