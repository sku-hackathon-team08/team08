from typing import Literal

from app.schemas.base import ApiModel

type ErrorCode = Literal[
    "BAD_REQUEST", "NOT_FOUND", "METHOD_NOT_ALLOWED", "INTERNAL_SERVER_ERROR"
]


class ErrorResponse(ApiModel):
    """필드별 오류 계약을 포함하지 않는 일반 HTTP 오류."""

    status: Literal[400, 404, 405, 500]
    code: ErrorCode
    detail: str
    errors: tuple[()]
