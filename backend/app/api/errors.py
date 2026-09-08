import logging
from collections.abc import Mapping

from fastapi.exception_handlers import http_exception_handler
from starlette.exceptions import HTTPException
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.schemas.errors import ErrorCode, ErrorResponse

logger = logging.getLogger(__name__)

_ERRORS: dict[int, tuple[ErrorCode, str]] = {
    400: ("BAD_REQUEST", "요청 형식이나 구성을 확인해주세요."),
    404: ("NOT_FOUND", "요청한 경로나 대상을 찾을 수 없습니다."),
    405: ("METHOD_NOT_ALLOWED", "지원하지 않는 요청 메서드입니다."),
    500: (
        "INTERNAL_SERVER_ERROR",
        "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
    ),
}


def _without_head_body(request: Request, response: Response) -> Response:
    if request.method == "HEAD":
        # GET 표현의 Content-Length 등 헤더를 유지하고 ASGI 본문만 비움.
        response.body = b""
    return response


def _error_response(
    request: Request,
    status: int,
    code: ErrorCode,
    detail: str,
    headers: Mapping[str, str] | None = None,
) -> Response:
    body = ErrorResponse.from_internal(
        status=status, code=code, detail=detail, errors=()
    )
    # 새 JSON 표현의 헤더는 다시 계산하고 Allow 등 오류 의미의 헤더는 보존.
    preserved_headers = {
        key: value
        for key, value in (headers or {}).items()
        if key.lower() not in {"content-type", "content-length", "content-encoding"}
    }
    response = JSONResponse(
        body.model_dump(mode="json"), status_code=status, headers=preserved_headers
    )
    return _without_head_body(request, response)


async def http_error_handler(request: Request, exc: Exception) -> Response:
    """확정한 HTTP 오류만 변환하고 나머지는 FastAPI 기본 처리를 유지."""
    assert isinstance(exc, HTTPException)
    error = _ERRORS.get(exc.status_code)
    if error is None:
        response = await http_exception_handler(request, exc)
        return _without_head_body(request, response)

    code, detail = error
    if exc.status_code == 500:
        # 처리된 HTTPException은 Uvicorn까지 전파되지 않으므로 여기서 한 번 기록.
        logger.error("앱에서 명시적 HTTP 500 오류를 반환했습니다.")
    elif isinstance(exc.detail, str):
        detail = exc.detail
    return _error_response(request, exc.status_code, code, detail, exc.headers)


async def unexpected_error_handler(request: Request, exc: Exception) -> Response:
    """원인은 Uvicorn에 맡기고 서버 오류 응답에는 안전한 안내만 제공."""
    # Starlette가 응답 후 원본 예외를 다시 던져 Uvicorn이 원인·스택을 기록.
    # 여기서 먼저 로깅하면 중복되며 응답 검증 오류의 입력도 노출될 수 있음.
    code, detail = _ERRORS[500]
    return _error_response(request, 500, code, detail)
