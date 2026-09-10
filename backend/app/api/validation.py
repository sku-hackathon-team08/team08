from fastapi.exceptions import RequestValidationError
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.schemas.validation import FieldError, ValidationErrorResponse


def validation_response(errors: list[FieldError]) -> JSONResponse:
    return JSONResponse(
        ValidationErrorResponse.from_internal(errors=errors).model_dump(mode="json"),
        status_code=422,
    )


async def request_validation_handler(request: Request, exc: Exception) -> Response:
    """검증 라이브러리의 입력·문맥·예외를 공개 오류에 복사하지 않는다."""
    assert isinstance(exc, RequestValidationError)
    errors = []
    for error in exc.errors():
        kind = error["type"]
        loc = error.get("loc", ())
        location = (
            loc[0] if loc and loc[0] in {"body", "query", "path", "header"} else "body"
        )
        path = list(loc[1:])
        if kind == "json_invalid":
            code, detail, path = "INVALID_JSON", "올바른 JSON을 입력해주세요.", []
        elif kind == "missing":
            code, detail = "REQUIRED", "필수 입력 항목입니다."
        elif kind == "duplicate_field":
            code, detail = (
                "DUPLICATE_FIELD",
                "같은 입력 항목을 여러 번 보낼 수 없습니다.",
            )
        elif kind == "extra_forbidden":
            code, detail = "UNKNOWN_FIELD", "지원하지 않는 입력 항목입니다."
        elif kind.endswith(("_type", "_parsing")):
            code, detail = "INVALID_TYPE", "입력값의 자료형을 확인해주세요."
        else:
            code, detail = "INVALID_VALUE", "입력값을 확인해주세요."
        # Pydantic union 분기는 실제 입력 경로가 아니므로 보수적으로 위치 전체로 표시.
        if any(
            str(p).startswith(("function-", "literal[", "tagged-union["))
            or p in {"str", "int", "float", "bool"}
            for p in path
        ):
            path = []
        if location == "header":
            path = [p.lower() if isinstance(p, str) else p for p in path]
        errors.append(
            FieldError.from_internal(
                location=location, path=path, code=code, detail=detail
            )
        )
    return validation_response(errors)
