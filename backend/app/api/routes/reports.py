from typing import Literal

from fastapi import APIRouter, Request
from fastapi.exceptions import RequestValidationError
from sqlalchemy import select
from starlette.responses import JSONResponse

from app.api.contract import ContractRoute
from app.api.idempotency import idempotency_key, json_fingerprint_input
from app.api.identity import CurrentIdentity, Db, require_role
from app.api.pagination import PageSize, page
from app.models.reports import Participation, Report, ReportLog
from app.schemas.errors import ServiceErrorResponse
from app.schemas.reports import (
    AdminIntake,
    CancelInput,
    ClaimInput,
    ClassificationInput,
    Log,
    MapPin,
    Page,
    ParticipationResult,
    ParticipationView,
    ReportCard,
    ReportDetail,
    ResolveInput,
    ResourceId,
    StaffIntake,
    StaffReport,
    SupportResult,
    VersionInput,
)
from app.schemas.validation import ValidationErrorResponse
from app.services import reports as service
from app.services import support
from app.services.idempotency import StoredResponse, execute_once, fingerprint

router = APIRouter(
    prefix="/api/v1",
    tags=["reports"],
    route_class=ContractRoute,
    responses={
        **{
            status: {"model": ServiceErrorResponse}
            for status in [401, 403, 404, 409, 413, 415]
        },
        422: {"model": ValidationErrorResponse},
    },
)


async def create_report(request: Request, identity, data, role: str):
    require_role(identity, role)
    key = idempotency_key(request)
    # 재응답도 현재 분석 소유권을 다시 확인한다.
    async with request.app.state.database.sessions() as access_db:
        await service.get_analysis(access_db, identity, data.analysis_id)

    async def operation(db):
        row = await service.intake(db, identity, data)
        value = await service.detail(db, row)
        result = service.staff_view(value) if role == "STAFF" else value
        return StoredResponse(
            201,
            result.model_dump(mode="json"),
            {"Location": f"/api/v1/{role.lower()}/reports/{row.id}"},
        )

    result = await execute_once(
        request.app.state.database.sessions,
        f"{identity.event.id}:{identity.actor.id}:{request.url.path}",
        key,
        fingerprint(await json_fingerprint_input(request)),
        operation,
    )
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)


@router.post("/staff/reports", status_code=201, response_model=StaffReport)
async def staff_intake(request: Request, data: StaffIntake, identity: CurrentIdentity):
    return await create_report(request, identity, data, "STAFF")


@router.post("/admin/reports", status_code=201, response_model=ReportDetail)
async def admin_intake(request: Request, data: AdminIntake, identity: CurrentIdentity):
    return await create_report(request, identity, data, "ADMIN")


@router.get("/staff/reports/{report_id}", response_model=StaffReport)
async def staff_detail(report_id: ResourceId, identity: CurrentIdentity, db: Db):
    require_role(identity, "STAFF")
    return service.staff_view(
        await service.detail(
            db, await service.get_report(db, identity, report_id, True)
        )
    )


@router.get("/admin/reports/{report_id}", response_model=ReportDetail)
async def admin_detail(report_id: ResourceId, identity: CurrentIdentity, db: Db):
    require_role(identity, "ADMIN")
    return await service.detail(db, await service.get_report(db, identity, report_id))


def enum_filter(raw: str | None, allowed: set[str], field: str) -> set[str]:
    if raw is None:
        return allowed
    values = set(raw.split(","))
    if not values <= allowed:
        raise RequestValidationError(
            [
                {
                    "type": "value_error",
                    "loc": ("query", field),
                    "msg": "필터 값을 확인해주세요.",
                }
            ]
        )
    return values


async def list_reports(
    request, identity, db, role, sort, types, statuses, cursor, page_size
):
    require_role(identity, role)
    allowed_status = {"RECEIVED", "IN_PROGRESS", "RESOLVED"} | (
        {"CANCELLED"} if role == "STAFF" else set()
    )
    conditions = [
        Report.event_id == identity.event.id,
        Report.type_value.in_(
            enum_filter(
                types, {"EMERGENCY", "FACILITY", "CROWD", "LOST", "OTHER"}, "types"
            )
        ),
        Report.status.in_(enum_filter(statuses, allowed_status, "statuses")),
    ]
    if role == "STAFF":
        conditions.append(Report.reporter_id == identity.actor.id)
    rows = list(
        (
            await db.scalars(
                select(Report)
                .where(*conditions)
                .order_by(Report.created_at.desc(), Report.id.desc())
            )
        ).all()
    )
    as_of = service.now()
    if role == "ADMIN":
        urgency = {"URGENT": 0, "CAUTION": 1, "NORMAL": 2}
        rows.sort(
            key=lambda row: (
                not service.is_unacknowledged(row, as_of),
                urgency[row.urgency_value] if sort == "urgency" else 0,
            )
        )
    selected = page(request, rows, cursor, page_size, str(identity.actor.id), as_of)
    values = [await service.detail(db, row, as_of) for row in selected["items"]]
    selected["items"] = [
        service.staff_view(value).model_dump(mode="json")
        if role == "STAFF"
        else ReportCard.model_validate(value.model_dump()).model_dump(mode="json")
        for value in values
    ]
    return selected


@router.get("/staff/reports", response_model=Page[StaffReport])
async def staff_list(
    request: Request,
    identity: CurrentIdentity,
    db: Db,
    types: str | None = None,
    statuses: str | None = None,
    cursor: str | None = None,
    page_size: PageSize = 20,
):
    return await list_reports(
        request, identity, db, "STAFF", "recent", types, statuses, cursor, page_size
    )


@router.get("/admin/reports", response_model=Page[ReportCard])
async def admin_list(
    request: Request,
    identity: CurrentIdentity,
    db: Db,
    sort: Literal["recent", "urgency"] = "recent",
    types: str | None = None,
    statuses: str | None = None,
    cursor: str | None = None,
    page_size: PageSize = 20,
):
    return await list_reports(
        request, identity, db, "ADMIN", sort, types, statuses, cursor, page_size
    )


@router.get("/admin/map-reports", response_model=Page[MapPin])
async def map_reports(
    request: Request,
    identity: CurrentIdentity,
    db: Db,
    types: str | None = None,
    statuses: str | None = None,
    cursor: str | None = None,
    page_size: PageSize = 20,
):
    value = await list_reports(
        request, identity, db, "ADMIN", "recent", types, statuses, cursor, page_size
    )
    keys = {
        "id",
        "version",
        "position",
        "status",
        "type",
        "urgency",
        "isUnacknowledged",
    }
    value["items"] = [
        {k: v for k, v in item.items() if k in keys} for item in value["items"]
    ]
    return value


@router.get("/admin/reports/{report_id}/logs", response_model=Page[Log])
async def logs(
    report_id: ResourceId,
    request: Request,
    identity: CurrentIdentity,
    db: Db,
    cursor: str | None = None,
    page_size: PageSize = 20,
):
    require_role(identity, "ADMIN")
    await service.get_report(db, identity, report_id)
    rows = list(
        (
            await db.scalars(
                select(ReportLog)
                .where(ReportLog.report_id == report_id)
                .order_by(ReportLog.occurred_at, ReportLog.id)
            )
        ).all()
    )
    value = page(
        request, rows, cursor, page_size, str(identity.actor.id), service.now()
    )
    value["items"] = [
        {
            "id": str(row.id),
            "action": row.action,
            "actor": await service.actor_view(db, row.actor_id),
            "occurredAt": row.occurred_at,
            "changes": row.changes,
            "note": row.note,
        }
        for row in value["items"]
    ]
    return value


async def action(identity, db, report_id, name, data):
    require_role(identity, "ADMIN")
    row = await service.change_report(db, identity, report_id, name, data)
    result = await service.detail(db, row)
    await db.commit()
    return result


@router.patch("/admin/reports/{report_id}/claim", response_model=ReportDetail)
async def claim(
    report_id: ResourceId, data: ClaimInput, identity: CurrentIdentity, db: Db
):
    return await action(identity, db, report_id, "claim", data)


@router.patch("/admin/reports/{report_id}/classification", response_model=ReportDetail)
async def classification(
    report_id: ResourceId, data: ClassificationInput, identity: CurrentIdentity, db: Db
):
    return await action(identity, db, report_id, "classification", data)


@router.patch("/admin/reports/{report_id}/resolve", response_model=ReportDetail)
async def resolve(
    report_id: ResourceId, data: ResolveInput, identity: CurrentIdentity, db: Db
):
    return await action(identity, db, report_id, "resolve", data)


@router.patch("/admin/reports/{report_id}/release", response_model=ReportDetail)
async def release(
    report_id: ResourceId, data: VersionInput, identity: CurrentIdentity, db: Db
):
    return await action(identity, db, report_id, "release", data)


@router.patch("/admin/reports/{report_id}/cancel", response_model=ReportDetail)
async def cancel(
    report_id: ResourceId, data: CancelInput, identity: CurrentIdentity, db: Db
):
    return await action(identity, db, report_id, "cancel", data)


async def support_create(request, identity, report_id, data, request_id=None):
    require_role(identity, "ADMIN")
    key = idempotency_key(request)
    async with request.app.state.database.sessions() as db:
        await service.get_report(db, identity, report_id)
        if request_id is not None:
            await support.get_request(db, report_id, request_id)

    async def operation(db):
        row = await service.lock_version(db, identity, report_id, data.expected_version)
        value = (
            await support.open_request(db, identity, row)
            if request_id is None
            else await support.join(db, identity, row, request_id)
        )
        return StoredResponse(201, value)

    result = await execute_once(
        request.app.state.database.sessions,
        f"{identity.event.id}:{identity.actor.id}:{request.url.path}",
        key,
        fingerprint(await json_fingerprint_input(request)),
        operation,
    )
    return JSONResponse(result.body, status_code=result.status, headers=result.headers)


@router.post(
    "/admin/reports/{report_id}/support-requests",
    status_code=201,
    response_model=SupportResult,
)
async def request_support(
    report_id: ResourceId,
    data: VersionInput,
    request: Request,
    identity: CurrentIdentity,
):
    return await support_create(request, identity, report_id, data)


@router.post(
    "/admin/reports/{report_id}/support-requests/{request_id}/participants",
    status_code=201,
    response_model=ParticipationResult,
)
async def join_support(
    report_id: ResourceId,
    request_id: ResourceId,
    data: VersionInput,
    request: Request,
    identity: CurrentIdentity,
):
    return await support_create(request, identity, report_id, data, request_id)


@router.patch(
    "/admin/reports/{report_id}/support-requests/{request_id}/close",
    response_model=SupportResult,
)
async def close_support(
    report_id: ResourceId,
    request_id: ResourceId,
    data: VersionInput,
    identity: CurrentIdentity,
    db: Db,
):
    require_role(identity, "ADMIN")
    await support.get_request(db, report_id, request_id)
    row = await service.lock_version(db, identity, report_id, data.expected_version)
    value = await support.close_request(db, identity, row, request_id)
    await db.commit()
    return value


@router.patch(
    "/admin/reports/{report_id}/support-requests/{request_id}/participants/{participation_id}/cancel",
    response_model=ParticipationResult,
)
async def leave_support(
    report_id: ResourceId,
    request_id: ResourceId,
    participation_id: ResourceId,
    data: VersionInput,
    identity: CurrentIdentity,
    db: Db,
):
    require_role(identity, "ADMIN")
    await service.get_report(db, identity, report_id)
    await support.get_request(db, report_id, request_id)
    row = await service.lock_version(db, identity, report_id, data.expected_version)
    value = await support.leave(db, identity, row, request_id, participation_id)
    await db.commit()
    return value


@router.get(
    "/admin/reports/{report_id}/support-requests/{request_id}/participants",
    response_model=Page[ParticipationView],
)
async def participants(
    report_id: ResourceId,
    request_id: ResourceId,
    request: Request,
    identity: CurrentIdentity,
    db: Db,
    cursor: str | None = None,
    page_size: PageSize = 20,
):
    require_role(identity, "ADMIN")
    await service.get_report(db, identity, report_id)
    await support.get_request(db, report_id, request_id)
    rows = list(
        (
            await db.scalars(
                select(Participation)
                .where(Participation.support_request_id == request_id)
                .order_by(Participation.joined_at, Participation.id)
            )
        ).all()
    )
    value = page(
        request, rows, cursor, page_size, str(identity.actor.id), service.now()
    )
    value["items"] = [
        await support.participation_view(db, row) for row in value["items"]
    ]
    return value
