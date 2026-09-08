from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.exceptions import HTTPException

from app.api.errors import http_error_handler, unexpected_error_handler
from app.api.router import api_router
from app.core.config import Settings
from app.core.logging import configure_logging
from app.db.session import open_database
from app.schemas.errors import ErrorResponse


def create_app(settings: Settings | None = None) -> FastAPI:
    """설정을 교체할 수 있는 앱 구성. 환경 설정은 시작 시 검증."""

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.settings = settings if settings is not None else Settings()
        configure_logging(app.state.settings.log_level)
        async with open_database(app.state.settings) as database:
            app.state.database = database
            try:
                yield
            finally:
                del app.state.database

    application = FastAPI(
        title="Team 08 API",
        lifespan=lifespan,
        description=(
            "앱의 400·404·405·500 오류는 ErrorResponse 형식을 사용합니다. "
            "미등록 경로의 404와 미지원 메서드의 405도 포함합니다. "
            "아래 작업별 응답에는 공통 500과 해당 작업에서 정의한 오류만 표시합니다. "
            "422 입력 검증 오류와 그 외 미정 상태의 HTTP 오류는 FastAPI 기본 응답이며 "
            "공통 오류 계약이 아직 적용되지 않았습니다."
        ),
        responses={500: {"model": ErrorResponse, "description": "서버 내부 오류"}},
    )
    application.add_exception_handler(HTTPException, http_error_handler)
    application.add_exception_handler(Exception, unexpected_error_handler)
    application.include_router(api_router)
    return application


app = create_app()
