from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entry import Actor
from app.models.reports import (
    Analysis,
    Participation,
    Report,
    ReportLog,
    SupportRequest,
)
from app.schemas.reports import AdminIntake, ReportDetail, StaffIntake, StaffReport
from app.services.analyses import get_analysis
from app.services.entry import Identity
from app.services.errors import ServiceError


def now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def is_unacknowledged(row: Report, as_of: str) -> bool:
    thresholds = {"URGENT": 180, "CAUTION": 600, "NORMAL": 1800}
    return row.status == "RECEIVED" and datetime.fromisoformat(
        as_of
    ) - datetime.fromisoformat(row.created_at) > timedelta(
        seconds=thresholds[row.urgency_value]
    )


async def actor_view(db: AsyncSession, actor_id: UUID | None) -> dict | None:
    if actor_id is None:
        return None
    actor = await db.get(Actor, actor_id)
    assert actor is not None
    return {"id": str(actor.id), "name": actor.name}


async def get_report(
    db: AsyncSession, identity: Identity, report_id: UUID, staff: bool = False
) -> Report:
    conditions = [Report.id == report_id, Report.event_id == identity.event.id]
    if staff:
        conditions.append(Report.reporter_id == identity.actor.id)
    row = await db.scalar(select(Report).where(*conditions))
    if row is None:
        raise ServiceError(404, "NOT_FOUND", "신고를 찾을 수 없습니다.")
    return row


async def detail(
    db: AsyncSession, row: Report, as_of: str | None = None
) -> ReportDetail:
    analysis = await db.get(Analysis, row.analysis_id)
    assert analysis is not None
    support = await db.scalar(
        select(SupportRequest).where(
            SupportRequest.report_id == row.id, SupportRequest.closed_at.is_(None)
        )
    )
    count = (
        0
        if support is None
        else await db.scalar(
            select(func.count())
            .select_from(Participation)
            .where(
                Participation.support_request_id == support.id,
                Participation.ended_at.is_(None),
            )
        )
    )
    return ReportDetail.from_internal(
        id=row.id,
        version=row.version,
        content_final=row.content_final,
        type={
            "value": row.type_value,
            "source": row.type_source,
            "confirmed_by": await actor_view(db, row.type_confirmed_by),
            "confirmed_at": row.type_confirmed_at,
        },
        urgency={
            "value": row.urgency_value,
            "source": row.urgency_source,
            "confirmed_by": await actor_view(db, row.urgency_confirmed_by),
            "confirmed_at": row.urgency_confirmed_at,
        },
        status=row.status,
        position=row.position,
        position_source=row.position_source,
        zone=row.zone,
        created_at=row.created_at,
        claimed_by=await actor_view(db, row.claimed_by),
        claimed_at=row.claimed_at,
        is_unacknowledged=is_unacknowledged(row, as_of or now()),
        support_request_id=None if support is None else support.id,
        active_supporter_count=count,
        reporter=await actor_view(db, row.reporter_id),
        input_method=analysis.input_method,
        transcript_raw=analysis.transcript_raw,
        content_suggested=analysis.content_suggested,
        type_suggested=analysis.type_suggested,
        urgency_suggested=analysis.urgency_suggested,
        resolved_at=row.resolved_at,
        resolve_note=row.resolve_note,
        cancelled_at=row.cancelled_at,
        cancelled_by=await actor_view(db, row.cancelled_by),
        cancel_reason=row.cancel_reason,
    )


def staff_view(value: ReportDetail) -> StaffReport:
    return StaffReport.model_validate(
        {
            key: val
            for key, val in value.model_dump().items()
            if key
            in {
                f.serialization_alias or name
                for name, f in StaffReport.model_fields.items()
            }
        }
    )


def add_log(
    db: AsyncSession,
    row: Report,
    actor_id: UUID,
    action: str,
    changes: list | None = None,
    note: str | None = None,
) -> None:
    db.add(
        ReportLog(
            report_id=row.id,
            actor_id=actor_id,
            occurred_at=now(),
            action=action,
            changes=changes or [],
            note=note,
        )
    )


async def intake(
    db: AsyncSession, identity: Identity, data: StaffIntake | AdminIntake
) -> Report:
    analysis = await get_analysis(db, identity, data.analysis_id)
    if analysis.status != "READY":
        raise ServiceError(409, "ANALYSIS_NOT_READY", "분석 완료 후 전송해주세요.")
    # 분석 행의 잠금을 먼저 획득해 서로 다른 키의 동시 접수도 직렬화.
    await db.execute(
        update(Analysis)
        .where(Analysis.id == analysis.id)
        .values(status=Analysis.status)
    )
    if await db.scalar(select(Report.id).where(Report.analysis_id == analysis.id)):
        raise ServiceError(
            409, "ANALYSIS_ALREADY_USED", "이미 접수에 사용한 분석입니다."
        )
    position = data.position.model_dump(by_alias=False)
    position["captured_at"] = (
        datetime.fromisoformat(data.position.captured_at)
        .astimezone(UTC)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )
    staff = identity.actor.role == "STAFF"
    if staff:
        position.update(lat=37.5683536, lng=126.8970733, accuracy_meters=None)
    urgency = (
        data.urgency if isinstance(data, StaffIntake) else analysis.urgency_suggested
    )
    row = Report(
        id=uuid4(),
        event_id=identity.event.id,
        reporter_id=identity.actor.id,
        analysis_id=analysis.id,
        content_final=data.content_final,
        type_value=data.type,
        urgency_value=urgency,
        type_source=(
            "STAFF_EDITED" if data.type != analysis.type_suggested else "AI_SUGGESTED"
        )
        if staff
        else "ADMIN_SELECTED",
        urgency_source="STAFF_EDITED"
        if staff and urgency != analysis.urgency_suggested
        else "AI_SUGGESTED",
        position=position,
        position_source="DEMO_FIXED" if staff else "MAP_SELECTED",
        zone=None,
        created_at=now(),
    )
    db.add(row)
    await db.flush()
    add_log(db, row, identity.actor.id, "REPORT_CREATED")
    return row


async def lock_version(
    db: AsyncSession, identity: Identity, report_id: UUID, version: int
) -> Report:
    row = await get_report(db, identity, report_id)
    changed = await db.scalar(
        update(Report)
        .where(Report.id == row.id, Report.version == version)
        .values(version=Report.version + 1)
        .returning(Report.id)
        .execution_options(synchronize_session=False)
    )
    if changed is None:
        raise ServiceError(
            409,
            "STALE_VERSION",
            "신고 정보가 변경되었습니다. 최신 내용을 확인해주세요.",
        )
    await db.refresh(row)
    return row


def require_owner(row: Report, identity: Identity) -> None:
    if row.claimed_by != identity.actor.id:
        raise ServiceError(403, "FORBIDDEN", "현재 담당자만 처리할 수 있습니다.")


def require_state(row: Report, *states: str) -> None:
    if row.status not in states:
        raise ServiceError(
            409, "INVALID_REPORT_STATE", "현재 신고 상태에서는 처리할 수 없습니다."
        )


async def close_support(
    db: AsyncSession, row: Report, identity: Identity, reason: str
) -> SupportRequest | None:
    support = await db.scalar(
        select(SupportRequest).where(
            SupportRequest.report_id == row.id, SupportRequest.closed_at.is_(None)
        )
    )
    if support:
        support.closed_at, support.close_reason = now(), reason
        await db.execute(
            update(Participation)
            .where(
                Participation.support_request_id == support.id,
                Participation.ended_at.is_(None),
            )
            .values(ended_at=support.closed_at, end_reason="REQUEST_CLOSED")
        )
        add_log(db, row, identity.actor.id, "SUPPORT_REQUEST_CLOSED", note=reason)
    return support


async def change_report(
    db: AsyncSession, identity: Identity, report_id: UUID, action: str, data
) -> Report:
    row = await lock_version(db, identity, report_id, data.expected_version)
    require_state(row, "RECEIVED", "IN_PROGRESS")
    old = {
        "status": row.status,
        "type": row.type_value,
        "urgency": row.urgency_value,
        "claimedBy": str(row.claimed_by) if row.claimed_by else None,
    }
    at = now()
    note = None
    if action == "claim":
        require_state(row, "RECEIVED")
        row.status, row.claimed_by, row.claimed_at = (
            "IN_PROGRESS",
            identity.actor.id,
            at,
        )
        row.type_value, row.urgency_value = data.type, data.urgency
        row.type_source = row.urgency_source = "ADMIN_CONFIRMED"
        row.type_confirmed_by = row.urgency_confirmed_by = identity.actor.id
        row.type_confirmed_at = row.urgency_confirmed_at = at
        log_action = "REPORT_CLAIMED"
    elif action == "cancel":
        row.status, row.cancelled_by, row.cancelled_at, row.cancel_reason = (
            "CANCELLED",
            identity.actor.id,
            at,
            data.cancel_reason,
        )
        note = data.cancel_reason
        await close_support(db, row, identity, "REPORT_CANCELLED")
        log_action = "REPORT_CANCELLED"
    else:
        require_state(row, "IN_PROGRESS")
        require_owner(row, identity)
        if action == "classification":
            for key in ("type", "urgency"):
                value = getattr(data, key)
                if value is not None:
                    setattr(row, key + "_value", value)
                    setattr(row, key + "_source", "ADMIN_CONFIRMED")
                    setattr(row, key + "_confirmed_by", identity.actor.id)
                    setattr(row, key + "_confirmed_at", at)
            log_action = "CLASSIFICATION_CHANGED"
        elif action == "resolve":
            row.status, row.resolved_at = "RESOLVED", at
            row.resolve_note = (
                data.resolve_note
                if data.resolve_note and data.resolve_note.strip()
                else None
            )
            note = row.resolve_note
            await close_support(db, row, identity, "REPORT_RESOLVED")
            log_action = "REPORT_RESOLVED"
        elif action == "release":
            row.status, row.claimed_by, row.claimed_at = "RECEIVED", None, None
            await close_support(db, row, identity, "REPORT_RELEASED")
            log_action = "ASSIGNMENT_RELEASED"
        else:
            raise ValueError("알 수 없는 내부 동작")
    after = {
        "status": row.status,
        "type": row.type_value,
        "urgency": row.urgency_value,
        "claimedBy": str(row.claimed_by) if row.claimed_by else None,
    }
    changes = [
        {"field": key, "before": old[key], "after": value}
        for key, value in after.items()
        if old[key] != value
    ]
    add_log(db, row, identity.actor.id, log_action, changes, note)
    await db.flush()
    return row
