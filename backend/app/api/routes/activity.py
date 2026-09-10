from typing import Literal

from fastapi import APIRouter, Request
from sqlalchemy import select
from starlette.concurrency import run_in_threadpool
from starlette.responses import Response

from app.api.contract import ContractRoute
from app.api.identity import CurrentIdentity, Db, require_role
from app.api.pagination import PageSize, page
from app.models.reports import Report
from app.schemas.activity import ActivityReport, AdminActivityReport, DashboardStats
from app.schemas.errors import ServiceErrorResponse
from app.schemas.validation import ValidationErrorResponse
from app.services.activity import activity_data
from app.services.activity_pdf import render_activity_pdf
from app.services.admin_activity import admin_activity_data
from app.services.reports import is_unacknowledged, now

router = APIRouter(
    prefix="/api/v1",
    tags=["activity"],
    route_class=ContractRoute,
    responses={
        **{
            status: {"model": ServiceErrorResponse}
            for status in [401, 403, 404, 409, 413, 415]
        },
        422: {"model": ValidationErrorResponse},
    },
)


@router.get("/staff/activity-report", response_model=ActivityReport, deprecated=True)
async def activity_report(
    request: Request,
    identity: CurrentIdentity,
    db: Db,
    period: Literal["TODAY", "WEEK", "ALL"] = "TODAY",
    cursor: str | None = None,
    page_size: PageSize = 20,
):
    require_role(identity, "STAFF")
    value = await activity_data(db, identity, period)
    selected = page(
        request,
        value["items"],
        cursor,
        page_size,
        str(identity.actor.id),
        value["asOf"],
    )
    value.update(items=selected["items"], nextCursor=selected["nextCursor"])
    return value


@router.get(
    "/staff/activity-report/export",
    deprecated=True,
    response_class=Response,
    responses={
        200: {
            "content": {
                "application/pdf": {"schema": {"type": "string", "format": "binary"}}
            }
        }
    },
)
async def export(
    identity: CurrentIdentity, db: Db, period: Literal["TODAY", "WEEK", "ALL"] = "TODAY"
):
    require_role(identity, "STAFF")
    data = await activity_data(db, identity, period)
    content = await run_in_threadpool(render_activity_pdf, data)
    return Response(
        content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="activity-report.pdf"',
            "Cache-Control": "no-store",
        },
    )


@router.get("/admin/stats", response_model=DashboardStats)
async def stats(identity: CurrentIdentity, db: Db):
    require_role(identity, "ADMIN")
    rows = list(
        (
            await db.scalars(select(Report).where(Report.event_id == identity.event.id))
        ).all()
    )
    as_of = now()
    return {
        "total": len(rows),
        "unacknowledged": sum(is_unacknowledged(row, as_of) for row in rows),
        "inProgress": sum(row.status == "IN_PROGRESS" for row in rows),
        "resolved": sum(row.status == "RESOLVED" for row in rows),
        "asOf": as_of,
    }


@router.get("/admin/activity-report", response_model=AdminActivityReport)
async def admin_activity_report(
    request: Request,
    identity: CurrentIdentity,
    db: Db,
    period: Literal["TODAY", "WEEK", "ALL"] = "TODAY",
    cursor: str | None = None,
    page_size: PageSize = 20,
):
    require_role(identity, "ADMIN")
    value = await admin_activity_data(db, identity, period)
    selected = page(
        request,
        value["items"],
        cursor,
        page_size,
        str(identity.actor.id),
        value["asOf"],
    )
    value.update(items=selected["items"], nextCursor=selected["nextCursor"])
    return value


@router.get(
    "/admin/activity-report/export",
    response_class=Response,
    responses={
        200: {
            "content": {
                "application/pdf": {"schema": {"type": "string", "format": "binary"}}
            }
        }
    },
)
async def admin_export(
    identity: CurrentIdentity, db: Db, period: Literal["TODAY", "WEEK", "ALL"] = "TODAY"
):
    require_role(identity, "ADMIN")
    data = await admin_activity_data(db, identity, period)
    content = await run_in_threadpool(render_activity_pdf, data)
    return Response(
        content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="admin-activity-report.pdf"',
            "Cache-Control": "no-store",
        },
    )
