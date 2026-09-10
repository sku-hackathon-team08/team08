from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reports import Participation, Report, SupportRequest
from app.services.entry import Identity
from app.services.errors import ServiceError
from app.services.reports import (
    actor_view,
    add_log,
    close_support,
    now,
    require_owner,
    require_state,
)


async def get_request(
    db: AsyncSession, report_id: UUID, request_id: UUID
) -> SupportRequest:
    row = await db.scalar(
        select(SupportRequest).where(
            SupportRequest.id == request_id, SupportRequest.report_id == report_id
        )
    )
    if row is None:
        raise ServiceError(404, "NOT_FOUND", "지원요청을 찾을 수 없습니다.")
    return row


async def request_view(db: AsyncSession, row: SupportRequest) -> dict:
    return {
        "id": str(row.id),
        "reportId": str(row.report_id),
        "openedBy": await actor_view(db, row.opened_by),
        "openedAt": row.opened_at,
        "closedAt": row.closed_at,
        "closeReason": row.close_reason,
    }


async def participation_view(db: AsyncSession, row: Participation) -> dict:
    return {
        "id": str(row.id),
        "supportRequestId": str(row.support_request_id),
        "actor": await actor_view(db, row.actor_id),
        "joinedAt": row.joined_at,
        "endedAt": row.ended_at,
        "endReason": row.end_reason,
    }


async def open_request(db: AsyncSession, identity: Identity, report: Report) -> dict:
    require_state(report, "IN_PROGRESS")
    require_owner(report, identity)
    if await db.scalar(
        select(SupportRequest.id).where(
            SupportRequest.report_id == report.id, SupportRequest.closed_at.is_(None)
        )
    ):
        raise ServiceError(409, "INVALID_REPORT_STATE", "이미 지원을 요청했습니다.")
    row = SupportRequest(
        id=uuid4(), report_id=report.id, opened_by=identity.actor.id, opened_at=now()
    )
    db.add(row)
    await db.flush()
    add_log(
        db,
        report,
        identity.actor.id,
        "SUPPORT_REQUEST_OPENED",
        [{"field": "supportRequestId", "before": None, "after": str(row.id)}],
    )
    return {
        "supportRequest": await request_view(db, row),
        "reportVersion": report.version,
    }


async def close_request(
    db: AsyncSession, identity: Identity, report: Report, request_id: UUID
) -> dict:
    row = await get_request(db, report.id, request_id)
    require_state(report, "IN_PROGRESS")
    require_owner(report, identity)
    if row.closed_at is not None:
        raise ServiceError(409, "INVALID_REPORT_STATE", "이미 종료된 지원요청입니다.")
    await close_support(db, report, identity, "MANUAL")
    return {
        "supportRequest": await request_view(db, row),
        "reportVersion": report.version,
    }


async def join(
    db: AsyncSession, identity: Identity, report: Report, request_id: UUID
) -> dict:
    row = await get_request(db, report.id, request_id)
    require_state(report, "IN_PROGRESS")
    if row.closed_at is not None or report.claimed_by == identity.actor.id:
        raise ServiceError(
            409, "INVALID_REPORT_STATE", "이 지원요청에 참여할 수 없습니다."
        )
    existing = await db.scalar(
        select(Participation.id).where(
            Participation.support_request_id == row.id,
            Participation.actor_id == identity.actor.id,
            Participation.ended_at.is_(None),
        )
    )
    if existing:
        raise ServiceError(409, "INVALID_REPORT_STATE", "이미 지원에 참여했습니다.")
    participation = Participation(
        id=uuid4(),
        support_request_id=row.id,
        actor_id=identity.actor.id,
        joined_at=now(),
    )
    db.add(participation)
    await db.flush()
    add_log(
        db,
        report,
        identity.actor.id,
        "SUPPORT_JOINED",
        [{"field": "participationId", "before": None, "after": str(participation.id)}],
    )
    return {
        "participation": await participation_view(db, participation),
        "reportVersion": report.version,
    }


async def leave(
    db: AsyncSession,
    identity: Identity,
    report: Report,
    request_id: UUID,
    participation_id: UUID,
) -> dict:
    row = await get_request(db, report.id, request_id)
    participation = await db.scalar(
        select(Participation).where(
            Participation.id == participation_id,
            Participation.support_request_id == row.id,
        )
    )
    if participation is None:
        raise ServiceError(404, "NOT_FOUND", "지원 참여를 찾을 수 없습니다.")
    if participation.actor_id != identity.actor.id:
        raise ServiceError(403, "FORBIDDEN", "본인의 지원 참여만 취소할 수 있습니다.")
    require_state(report, "IN_PROGRESS")
    if row.closed_at is not None or participation.ended_at is not None:
        raise ServiceError(409, "INVALID_REPORT_STATE", "이미 종료된 지원 참여입니다.")
    participation.ended_at, participation.end_reason = now(), "SELF_CANCELLED"
    add_log(
        db,
        report,
        identity.actor.id,
        "SUPPORT_LEFT",
        [{"field": "participationId", "before": str(participation.id), "after": None}],
    )
    return {
        "participation": await participation_view(db, participation),
        "reportVersion": report.version,
    }
