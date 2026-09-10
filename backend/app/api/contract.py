import json
from collections.abc import Callable, Coroutine
from typing import Any

from fastapi.routing import APIRoute
from pydantic import BaseModel
from starlette.exceptions import HTTPException
from starlette.requests import Request
from starlette.responses import Response

from app.api.validation import validation_response
from app.schemas.validation import FieldError
from app.services.errors import ServiceError


class DuplicateKey(ValueError):
    pass


def unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result = {}
    for key, value in pairs:
        if key in result:
            raise DuplicateKey()
        result[key] = value
    return result


class ContractRoute(APIRoute):
    """축제 경계에서 파서가 버릴 수 있는 중복 JSON·쿼리 입력을 먼저 검출."""

    def get_route_handler(self) -> Callable[[Request], Coroutine[Any, Any, Response]]:
        if "POST" in (self.methods or set()) and not self.path.endswith("/sessions"):
            extra = dict(self.openapi_extra or {})
            extra["parameters"] = [
                {
                    "in": "header",
                    "name": "Idempotency-Key",
                    "required": True,
                    "schema": {
                        "type": "string",
                        "format": "uuid",
                        "description": "소문자 하이픈 포함 UUIDv4",
                    },
                }
            ]
            self.openapi_extra = extra
        handler = super().get_route_handler()
        allowed_queries = set()

        def query_names(dependant):
            for param in dependant.query_params:
                if isinstance(param.field_info.annotation, type) and issubclass(
                    param.field_info.annotation, BaseModel
                ):
                    allowed_queries.update(
                        field.alias or name
                        for name, field in param.field_info.annotation.model_fields.items()
                    )
                else:
                    allowed_queries.add(param.alias)
            for dependency in dependant.dependencies:
                query_names(dependency)

        query_names(self.dependant)

        async def checked(request: Request) -> Response:
            # 제한을 초과하는 업로드는 multipart 임시 파일을 만들기 전에 중단한다.
            if request.method in {"POST", "PATCH"}:
                chunks = []
                total = 0
                async for chunk in request.stream():
                    total += len(chunk)
                    if total > 11 * 1024 * 1024:
                        raise ServiceError(
                            413, "PAYLOAD_TOO_LARGE", "요청 크기 제한을 초과했습니다."
                        )
                    chunks.append(chunk)
                request._body = b"".join(chunks)
            query = request.query_params
            unknown = set(query) - allowed_queries
            if unknown:
                return validation_response(
                    [
                        FieldError.from_internal(
                            location="query",
                            path=[key],
                            code="UNKNOWN_FIELD",
                            detail="지원하지 않는 입력 항목입니다.",
                        )
                        for key in sorted(unknown)
                    ]
                )
            duplicates = [key for key in query if len(query.getlist(key)) > 1]
            if duplicates:
                return validation_response(
                    [
                        FieldError.from_internal(
                            location="query",
                            path=[key],
                            code="DUPLICATE_FIELD",
                            detail="같은 입력 항목을 여러 번 보낼 수 없습니다.",
                        )
                        for key in duplicates
                    ]
                )
            content_type = (
                request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
            )
            if content_type == "application/json":
                try:
                    json.loads(await request.body(), object_pairs_hook=unique_object)
                except DuplicateKey:
                    return validation_response(
                        [
                            FieldError.from_internal(
                                location="body",
                                path=[],
                                code="DUPLICATE_FIELD",
                                detail="JSON 객체에 같은 키를 여러 번 보낼 수 없습니다.",
                            )
                        ]
                    )
                except (ValueError, UnicodeDecodeError):
                    # 일반 JSON 파싱 오류는 FastAPI의 RequestValidationError로 변환.
                    pass
            try:
                return await handler(request)
            except HTTPException as exc:
                if content_type == "multipart/form-data" and exc.status_code == 400:
                    return validation_response(
                        [
                            FieldError.from_internal(
                                location="body",
                                path=[],
                                code="INVALID_VALUE",
                                detail="multipart 입력 형식과 항목 수를 확인해주세요.",
                            )
                        ]
                    )
                raise

        return checked
