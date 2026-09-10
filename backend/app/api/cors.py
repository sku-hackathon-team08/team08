from starlette.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send


class ConfiguredCORS:
    """설정은 lifespan에서 로드하고 첫 HTTP 요청부터 선택한 origin에 적용한다."""

    def __init__(self, app: ASGIApp):
        self.app = app
        self.middleware: CORSMiddleware | None = None

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        if self.middleware is None:
            settings = getattr(scope["app"].state, "settings", None)
            origins = settings.cors_origins if settings else []
            self.middleware = CORSMiddleware(
                self.app,
                allow_origins=origins,
                allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
                allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
                expose_headers=["Location", "Content-Disposition"],
            )
        await self.middleware(scope, receive, send)
