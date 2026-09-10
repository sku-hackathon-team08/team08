"""관리자 본인이 수행한 처리 로그를 기간별로 조회한다."""

from collections import Counter
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reports import Report, ReportLog
from app.services.activity import period_range
from app.services.entry import Identity
from app.services.reports import now

HANDLING_ACTIONS = (
    "REPORT_CLAIMED",
    "ASSIGNMENT_RELEASED",
    "CLASSIFICATION_CHANGED",
    "REPORT_RESOLVED",
    "REPORT_CANCELLED",
)


async def admin_activity_data(
    db: AsyncSession, identity: Identity, period: str
) -> dict:
    as_of = now()
    start, end = period_range(period, as_of)
    conditions = [
        Report.event_id == identity.event.id,
        ReportLog.actor_id == identity.actor.id,
        ReportLog.action.in_(HANDLING_ACTIONS),
    ]
    if start is not None and end is not None:
        conditions.extend([ReportLog.occurred_at >= start, ReportLog.occurred_at < end])
    records = (
        await db.execute(
            select(ReportLog, Report)
            .join(Report, Report.id == ReportLog.report_id)
            .where(*conditions)
            .order_by(ReportLog.occurred_at.desc(), ReportLog.id.desc())
        )
    ).all()
    items = []
    durations = []
    for log, report in records:
        seconds = None
        # 완료 후 재개방/재배정은 금지되어 최종 배정 시각이 보존된다.
        if log.action == "REPORT_RESOLVED" and report.claimed_at and report.resolved_at:
            seconds = (
                datetime.fromisoformat(report.resolved_at)
                - datetime.fromisoformat(report.claimed_at)
            ).total_seconds()
            durations.append(seconds)
        items.append(
            {
                "id": str(log.id),
                "reportId": str(report.id),
                "action": log.action,
                "occurredAt": log.occurred_at,
                "changes": log.changes,
                "note": log.note,
                "contentFinal": report.content_final,
                "currentType": report.type_value,
                "currentStatus": report.status,
                "zone": report.zone,
                "createdAt": report.created_at,
                "processingSeconds": seconds,
            }
        )
    reports = {report.id: report for _, report in records}
    counts = Counter(log.action for log, _ in records)
    distribution = Counter(report.type_value for report in reports.values())
    return {
        "actor": {
            "id": str(identity.actor.id),
            "name": identity.actor.name,
            "team": identity.actor.team,
        },
        "range": {"from": start, "to": end, "timeZone": "Asia/Seoul"},
        "summary": {
            "totalReports": len(reports),
            "totalActions": len(items),
            "claimed": counts["REPORT_CLAIMED"],
            "released": counts["ASSIGNMENT_RELEASED"],
            "classificationChanged": counts["CLASSIFICATION_CHANGED"],
            "resolved": counts["REPORT_RESOLVED"],
            "cancelled": counts["REPORT_CANCELLED"],
            "averageProcessingSeconds": sum(durations) / len(durations)
            if durations
            else None,
        },
        "typeDistribution": [
            {"type": kind, "count": distribution[kind]}
            for kind in ["EMERGENCY", "FACILITY", "CROWD", "LOST", "OTHER"]
        ],
        "items": items,
        "nextCursor": None,
        "asOf": as_of,
    }
