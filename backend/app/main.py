from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.router import api_router
from app.core.config import Settings


def create_app(settings: Settings | None = None) -> FastAPI:
    """설정을 교체할 수 있는 앱 구성. 환경 설정은 시작 시 검증."""

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.settings = settings if settings is not None else Settings()
        yield

    application = FastAPI(title="Team 08 API", lifespan=lifespan)
    application.include_router(api_router)
    return application


app = create_app()
