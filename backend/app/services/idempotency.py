import hashlib
import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.idempotency import IdempotencyRecord
from app.services.errors import ServiceError


@dataclass(frozen=True)
class StoredResponse:
    status: int
    body: dict
    headers: dict[str, str] = field(default_factory=dict)


def fingerprint(value: object) -> str:
    """JSON 의미값 비교. 타입·생략·배열 순서는 유지하고 동등한 숫자는 통일."""

    def canonical(item: object) -> object:
        if item is None or isinstance(item, (str, bool)):
            return [type(item).__name__, item]
        if isinstance(item, (int, float, Decimal)):
            number = Decimal(str(item))
            if not number.is_finite():
                raise ValueError("유한한 JSON 숫자만 지원합니다.")
            sign, digits, exponent = number.as_tuple()
            assert isinstance(exponent, int)
            digits = list(digits)
            while digits and digits[-1] == 0:
                digits.pop()
                exponent += 1
            return ["number", [sign, digits, exponent] if digits else [0, [], 0]]
        if isinstance(item, list):
            return ["array", [canonical(v) for v in item]]
        if isinstance(item, dict) and all(isinstance(key, str) for key in item):
            return ["object", [[key, canonical(item[key])] for key in sorted(item)]]
        raise TypeError("JSON 값만 지문으로 변환할 수 있습니다.")

    data = json.dumps(canonical(value), ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(data.encode()).hexdigest()


async def execute_once(
    sessions: async_sessionmaker[AsyncSession],
    scope: str,
    key: UUID,
    request_fingerprint: str,
    operation: Callable[[AsyncSession], Awaitable[StoredResponse]],
) -> StoredResponse:
    """호출자는 인증·자원 접근·입력 검증 이후 호출한다. 시간 만료·자동 재시도 없음."""
    async with sessions() as db:
        record = IdempotencyRecord(
            scope=scope, key=str(key), fingerprint=request_fingerprint
        )
        db.add(record)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            existing = await db.scalar(
                select(IdempotencyRecord).where(
                    IdempotencyRecord.scope == scope, IdempotencyRecord.key == str(key)
                )
            )
            if existing is None:
                raise
            if existing.fingerprint != request_fingerprint:
                raise ServiceError(
                    409,
                    "IDEMPOTENCY_CONFLICT",
                    "같은 키로 다른 요청을 보낼 수 없습니다.",
                ) from None
            if existing.status is None:
                raise ServiceError(
                    409, "REQUEST_IN_PROGRESS", "기존 요청의 결과를 확인해주세요."
                ) from None
            return StoredResponse(
                existing.status, existing.body or {}, existing.headers or {}
            )
        record_id = record.id
        try:
            result = await operation(db)
            record.status, record.body, record.headers = (
                result.status,
                result.body,
                result.headers,
            )
            await db.commit()
            return result
        except ServiceError as error:
            await db.rollback()
            # 업무 저장은 롤백한 뒤 공개 실패 결과만 별도 트랜잭션으로 보관.
            stored = await db.get(IdempotencyRecord, record_id)
            assert stored is not None
            stored.status, stored.body, stored.headers = error.status, error.body(), {}
            await db.commit()
            return StoredResponse(error.status, error.body())
        # 서버 오류·취소·commit 결과 불명은 pending으로 남기며 자동 재실행하지 않는다.
