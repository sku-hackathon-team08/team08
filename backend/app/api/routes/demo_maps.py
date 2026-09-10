from uuid import UUID

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.repositories.demo_maps import AssetName, get_demo_asset, get_demo_map
from app.schemas.demo_map import DemoMapResponse
from app.schemas.errors import ErrorResponse

router = APIRouter(prefix="/api/v1/demo/events", tags=["public-demo"])


@router.get(
    "/{event_id}/map",
    response_model=DemoMapResponse,
    responses={404: {"model": ErrorResponse}},
)
def read_map(event_id: UUID) -> DemoMapResponse:
    """공개 데모 행사 데이터. 인증된 events/current 계약과 구분합니다."""
    data = get_demo_map(event_id)
    if data is None:
        raise HTTPException(status_code=404, detail="데모 행사를 찾을 수 없습니다.")
    return data


@router.get(
    "/{event_id}/assets/{asset_name}", responses={404: {"model": ErrorResponse}}
)
def read_asset(event_id: UUID, asset_name: AssetName) -> FileResponse:
    """해당 데모 행사에 연결된 파일만 제공하며 임의 파일 경로는 받지 않습니다."""
    path = get_demo_asset(event_id, asset_name)
    if path is None:
        raise HTTPException(status_code=404, detail="데모 행사를 찾을 수 없습니다.")
    media_type = {
        "concert.glb": "model/gltf-binary",
        "concert-zones.geojson": "application/geo+json",
        "concert-coordinates.csv": "text/csv",
    }[asset_name]
    return FileResponse(path, media_type=media_type, filename=asset_name)
