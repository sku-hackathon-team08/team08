from typing import Annotated, Literal

from pydantic import Field

from app.schemas.base import ApiModel


class FieldError(ApiModel):
    location: Literal["body", "query", "path", "header"]
    path: list[str | Annotated[int, Field(ge=0)]]
    code: Literal[
        "REQUIRED",
        "INVALID_TYPE",
        "INVALID_VALUE",
        "UNKNOWN_FIELD",
        "DUPLICATE_FIELD",
        "INVALID_JSON",
    ]
    detail: str


class ValidationErrorResponse(ApiModel):
    status: Literal[422] = 422
    code: Literal["VALIDATION_ERROR"] = "VALIDATION_ERROR"
    detail: str = "입력값을 확인해주세요."
    errors: list[FieldError]
