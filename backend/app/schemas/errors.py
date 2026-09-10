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


class ServiceErrorResponse(ApiModel):
    status: Literal[401, 403, 404, 409, 413, 415]
    code: Literal[
        "UNAUTHENTICATED",
        "FORBIDDEN",
        "NOT_FOUND",
        "MAP_NOT_READY",
        "STALE_VERSION",
        "INVALID_REPORT_STATE",
        "IDEMPOTENCY_CONFLICT",
        "REQUEST_IN_PROGRESS",
        "ANALYSIS_NOT_READY",
        "ANALYSIS_ALREADY_USED",
        "AUDIO_TOO_LARGE",
        "PAYLOAD_TOO_LARGE",
        "UNSUPPORTED_MEDIA_TYPE",
    ]
    detail: str
    errors: tuple[()]
