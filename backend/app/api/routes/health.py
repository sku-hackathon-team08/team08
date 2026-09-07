from fastapi import APIRouter

from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """앱의 응답 가능 여부를 반환한다. DB·외부 서비스 상태는 확인하지 않는다."""
    return HealthResponse(status="ok")
