from collections import Counter
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reports import Report
from app.services.entry import Identity
from app.services.reports import detail, now, staff_view


def period_range(period: str, as_of: str) -> tuple[str | None, str | None]:
    if period == "ALL":
        return None, None
    local = datetime.fromisoformat(as_of).astimezone(ZoneInfo("Asia/Seoul"))
    start = local.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "WEEK":
        start -= timedelta(days=start.weekday())
    end = start + timedelta(days=7 if period == "WEEK" else 1)

    def utc(value):
        return (
            value.astimezone(UTC)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z")
        )

    return utc(start), utc(end)


def summarize(rows: list[Report]) -> dict:
    durations = [
        (
            datetime.fromisoformat(row.resolved_at)
            - datetime.fromisoformat(row.claimed_at)
        ).total_seconds()
        for row in rows
        if row.status == "RESOLVED" and row.resolved_at and row.claimed_at
    ]
    return {
        "total": len(rows),
        "resolved": sum(row.status == "RESOLVED" for row in rows),
        "cancelled": sum(row.status == "CANCELLED" for row in rows),
        "averageProcessingSeconds": sum(durations) / len(durations)
        if durations
        else None,
    }


async def activity_data(db: AsyncSession, identity: Identity, period: str) -> dict:
    as_of = now()
    start, end = period_range(period, as_of)
    conditions = [
        Report.event_id == identity.event.id,
        Report.reporter_id == identity.actor.id,
    ]
    if start is not None and end is not None:
        conditions.extend([Report.created_at >= start, Report.created_at < end])
    rows = list(
        (
            await db.scalars(
                select(Report)
                .where(*conditions)
                .order_by(Report.created_at.desc(), Report.id.desc())
            )
        ).all()
    )
    distribution = Counter(row.type_value for row in rows)
    return {
        "actor": {
            "id": str(identity.actor.id),
            "name": identity.actor.name,
            "team": identity.actor.team,
        },
        "range": {"from": start, "to": end, "timeZone": "Asia/Seoul"},
        "summary": summarize(rows),
        "typeDistribution": [
            {"type": kind, "count": distribution[kind]}
            for kind in ["EMERGENCY", "FACILITY", "CROWD", "LOST", "OTHER"]
        ],
        "items": [
            staff_view(await detail(db, row, as_of)).model_dump(mode="json")
            for row in rows
        ],
        "nextCursor": None,
        "asOf": as_of,
    }
