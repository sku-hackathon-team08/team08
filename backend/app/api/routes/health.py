from fastapi import APIRouter

from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """앱 응답 상태 확인. DB·외부 서비스 점검 제외."""
    return HealthResponse(status="ok")
