from fastapi import APIRouter, Response

from app.api.contract import ContractRoute
from app.api.identity import CurrentIdentity, Db
from app.repositories.demo_maps import get_demo_map
from app.schemas.demo_map import DemoMapResponse
from app.schemas.entry import SessionCreated, SessionInfo, SessionInput
from app.schemas.errors import ServiceErrorResponse
from app.schemas.validation import ValidationErrorResponse
from app.services.entry import create_session
from app.services.errors import ServiceError

router = APIRouter(
    prefix="/api/v1",
    tags=["entry"],
    route_class=ContractRoute,
    responses={
        **{
            status: {"model": ServiceErrorResponse}
            for status in [401, 403, 404, 409, 413, 415]
        },
        422: {"model": ValidationErrorResponse},
    },
)


@router.post("/sessions", response_model=SessionCreated, status_code=201)
async def enter(data: SessionInput, db: Db) -> SessionCreated:
    return await create_session(db, data)


@router.get("/sessions/me", response_model=SessionInfo)
async def me(identity: CurrentIdentity) -> SessionInfo:
    return identity.info()


@router.delete("/sessions/me", status_code=204)
async def logout(identity: CurrentIdentity, db: Db) -> Response:
    identity.session.revoked = True
    await db.commit()
    return Response(status_code=204)


@router.get("/events/current/map", response_model=DemoMapResponse)
async def current_map(identity: CurrentIdentity) -> DemoMapResponse:
    data = get_demo_map(identity.event.map_id)
    if data is None:
        raise ServiceError(
            409, "MAP_NOT_READY", "행사 지도 데이터가 준비되지 않았습니다."
        )
    return data.model_copy(
        update={"event_id": identity.event.id, "name": identity.event.name}
    )
