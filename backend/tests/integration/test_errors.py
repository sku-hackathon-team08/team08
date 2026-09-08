import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass
from pathlib import Path

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient, Response
from starlette.types import Message, Scope

from app.core.config import Settings
from app.main import create_app
from app.schemas.base import ApiModel
from app.schemas.errors import ErrorResponse

SERVER_ERROR_DETAIL = "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
PUBLIC_DETAIL = "요청을 처리할 수 없습니다. 입력 내용을 확인해주세요."
PRIVATE_DETAIL = "private-secret SELECT password FROM private_table"
HTTP_HEADERS = {
    "WWW-Authenticate": "Bearer",
    "Retry-After": "30",
    "Allow": "GET, HEAD",
    "X-Error-Context": "retained",
}


class InputDocument(ApiModel):
    display_name: str


class OutputDocument(ApiModel):
    item_count: int


@dataclass
class ErrorHarness:
    app: FastAPI
    client: AsyncClient


@pytest.fixture
async def errors(tmp_path: Path) -> AsyncIterator[ErrorHarness]:
    app = create_app(
        Settings(_env_file=None, database_url=f"sqlite:///{tmp_path}/errors.sqlite3")
    )

    @app.api_route(
        "/errors/http/{status_code}", methods=["GET", "HEAD"], include_in_schema=False
    )
    async def http_error(status_code: int) -> None:
        raise HTTPException(
            status_code=status_code,
            detail=PRIVATE_DETAIL if status_code == 500 else PUBLIC_DETAIL,
            headers=HTTP_HEADERS,
        )

    @app.get("/errors/structured/{status_code}")
    async def structured_error(status_code: int) -> None:
        raise HTTPException(
            status_code=status_code,
            detail={"private": PRIVATE_DETAIL},
            headers=HTTP_HEADERS,
        )

    @app.get(
        "/errors/bad-request",
        responses={400: {"model": ErrorResponse, "description": "잘못된 요청"}},
    )
    async def bad_request() -> None:
        raise HTTPException(status_code=400, detail=PUBLIC_DETAIL)

    @app.get("/errors/stale-headers")
    async def stale_headers() -> None:
        raise HTTPException(
            status_code=400,
            detail=PUBLIC_DETAIL,
            headers={
                "Content-Type": "text/plain",
                "Content-Length": "1",
                "Content-Encoding": "gzip",
                "Allow": "GET",
            },
        )

    @app.api_route(
        "/errors/unexpected", methods=["GET", "HEAD"], include_in_schema=False
    )
    async def unexpected_error() -> None:
        raise RuntimeError(PRIVATE_DETAIL)

    @app.get("/errors/invalid-response", response_model=OutputDocument)
    async def invalid_response() -> dict[str, str]:
        return {"itemCount": PRIVATE_DETAIL}

    @app.post("/errors/input")
    async def validated_input(document: InputDocument) -> InputDocument:
        return document

    async with (
        app.router.lifespan_context(app),
        AsyncClient(
            transport=ASGITransport(app=app, raise_app_exceptions=False),
            base_url="http://test",
        ) as client,
    ):
        yield ErrorHarness(app=app, client=client)


def assert_error_response(
    response: Response, status: int, code: str, detail: str
) -> None:
    assert response.status_code == status
    assert response.headers["content-type"] == "application/json"
    assert response.json() == {
        "status": status,
        "code": code,
        "detail": detail,
        "errors": [],
    }


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("status", "code"),
    [(400, "BAD_REQUEST"), (404, "NOT_FOUND"), (405, "METHOD_NOT_ALLOWED")],
)
async def test_explicit_http_errors_keep_public_detail_and_headers(
    errors: ErrorHarness, status: int, code: str
) -> None:
    response = await errors.client.get(f"/errors/http/{status}")

    assert_error_response(response, status, code, PUBLIC_DETAIL)
    for name, value in HTTP_HEADERS.items():
        assert response.headers[name] == value


@pytest.mark.anyio
async def test_missing_route_returns_common_not_found(errors: ErrorHarness) -> None:
    response = await errors.client.get("/missing")

    assert_error_response(response, 404, "NOT_FOUND", "Not Found")


@pytest.mark.anyio
async def test_unsupported_method_returns_common_error_with_allow_header(
    errors: ErrorHarness,
) -> None:
    response = await errors.client.post("/health")

    assert_error_response(response, 405, "METHOD_NOT_ALLOWED", "Method Not Allowed")
    assert response.headers["allow"] == "GET"


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("status", "code"),
    [
        (400, "BAD_REQUEST"),
        (404, "NOT_FOUND"),
        (405, "METHOD_NOT_ALLOWED"),
        (500, "INTERNAL_SERVER_ERROR"),
    ],
)
async def test_structured_http_details_are_replaced_with_safe_strings(
    errors: ErrorHarness, status: int, code: str
) -> None:
    response = await errors.client.get(f"/errors/structured/{status}")

    assert response.status_code == status
    body = response.json()
    assert set(body) == {"status", "code", "detail", "errors"}
    assert body["status"] == status
    assert body["code"] == code
    assert isinstance(body["detail"], str)
    assert body["detail"]
    assert body["errors"] == []
    assert "private" not in response.text
    assert "SELECT" not in response.text
    if status == 500:
        assert body["detail"] == SERVER_ERROR_DETAIL


@pytest.mark.anyio
async def test_explicit_http_500_hides_detail_preserves_headers_and_logs_once(
    errors: ErrorHarness,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.clear()
    response = await errors.client.get("/errors/http/500")

    assert_error_response(response, 500, "INTERNAL_SERVER_ERROR", SERVER_ERROR_DETAIL)
    for name, value in HTTP_HEADERS.items():
        assert response.headers[name] == value
    records = [record for record in caplog.records if record.levelno >= logging.ERROR]
    assert len(records) == 1
    assert "private-secret" not in caplog.text
    assert "SELECT" not in caplog.text


@pytest.mark.anyio
async def test_replaced_json_recomputes_representation_headers(
    errors: ErrorHarness,
) -> None:
    response = await errors.client.get("/errors/stale-headers")

    assert_error_response(response, 400, "BAD_REQUEST", PUBLIC_DETAIL)
    assert int(response.headers["content-length"]) == len(response.content)
    assert "content-encoding" not in response.headers
    assert response.headers["allow"] == "GET"


@pytest.mark.anyio
@pytest.mark.parametrize("path", ["/errors/unexpected", "/errors/invalid-response"])
async def test_server_failures_return_safe_500_instead_of_request_422(
    errors: ErrorHarness, path: str
) -> None:
    response = await errors.client.get(path)

    assert_error_response(response, 500, "INTERNAL_SERVER_ERROR", SERVER_ERROR_DETAIL)
    assert "private-secret" not in response.text
    assert "SELECT" not in response.text
    assert "RuntimeError" not in response.text
    assert "ResponseValidationError" not in response.text


@pytest.mark.anyio
@pytest.mark.parametrize("document", [{}, {"displayName": []}])
async def test_request_validation_keeps_fastapi_422_until_field_contract_is_defined(
    errors: ErrorHarness, document: dict[str, object]
) -> None:
    response = await errors.client.post("/errors/input", json=document)

    assert response.status_code == 422
    assert response.headers["content-type"] == "application/json"
    body = response.json()
    assert set(body) == {"detail"}
    assert isinstance(body["detail"], list)
    assert body["detail"][0]["loc"] == ["body", "displayName"]


@pytest.mark.anyio
async def test_invalid_json_remains_422(errors: ErrorHarness) -> None:
    response = await errors.client.post(
        "/errors/input", content="{", headers={"Content-Type": "application/json"}
    )

    assert response.status_code == 422
    assert set(response.json()) == {"detail"}
    assert response.json()["detail"][0]["type"] == "json_invalid"


@pytest.mark.anyio
@pytest.mark.parametrize("status", [401, 403, 409, 422, 429, 503])
async def test_unmapped_http_errors_keep_native_status_detail_and_headers(
    errors: ErrorHarness, status: int
) -> None:
    response = await errors.client.get(f"/errors/structured/{status}")

    assert response.status_code == status
    assert response.json() == {"detail": {"private": PRIVATE_DETAIL}}
    for name, value in HTTP_HEADERS.items():
        assert response.headers[name] == value


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("path", "status"),
    [
        ("/missing", 404),
        ("/health", 405),
        ("/errors/http/400", 400),
        ("/errors/http/404", 404),
        ("/errors/http/405", 405),
        ("/errors/http/500", 500),
        ("/errors/http/401", 401),
        ("/errors/unexpected", 500),
    ],
)
async def test_head_errors_emit_no_asgi_response_body(
    errors: ErrorHarness, path: str, status: int
) -> None:
    # HTTPX가 HEAD 본문을 삭제하므로 ASGI 전송 메시지 자체를 확인한다.
    messages: list[Message] = []
    scope: Scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "HEAD",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "root_path": "",
        "query_string": b"",
        "headers": [],
        "client": ("test", 123),
        "server": ("test", 80),
    }

    async def receive() -> Message:
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message: Message) -> None:
        messages.append(message)

    if path == "/errors/unexpected":
        # ServerErrorMiddleware는 응답 전송 뒤 서버 로깅을 위해 원인을 재전파한다.
        with pytest.raises(RuntimeError, match="private-secret"):
            await errors.app(scope, receive, send)
    else:
        await errors.app(scope, receive, send)

    starts = [
        message for message in messages if message["type"] == "http.response.start"
    ]
    assert len(starts) == 1
    assert starts[0]["status"] == status
    bodies = [
        message for message in messages if message["type"] == "http.response.body"
    ]
    assert bodies
    assert all(message.get("body", b"") == b"" for message in bodies)
    assert bodies[-1].get("more_body", False) is False


@pytest.mark.anyio
async def test_health_success_is_unchanged_with_error_handlers(
    errors: ErrorHarness,
) -> None:
    response = await errors.client.get("/health")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"
    assert response.json() == {"status": "ok"}


@pytest.mark.anyio
async def test_openapi_error_model_matches_runtime_and_keeps_422_separate(
    errors: ErrorHarness,
) -> None:
    response = await errors.client.get("/openapi.json")

    assert response.status_code == 200
    document = response.json()
    schemas = document["components"]["schemas"]
    health_responses = document["paths"]["/health"]["get"]["responses"]
    error_ref = health_responses["500"]["content"]["application/json"]["schema"]["$ref"]
    error_schema = schemas[error_ref.rsplit("/", 1)[-1]]
    assert set(error_schema["properties"]) == {"status", "code", "detail", "errors"}
    assert set(error_schema["required"]) == {"status", "code", "detail", "errors"}
    properties = error_schema["properties"]
    assert properties["status"]["type"] == "integer"
    assert set(properties["status"]["enum"]) == {400, 404, 405, 500}
    code_schema = properties["code"]
    if "$ref" in code_schema:
        code_schema = schemas[code_schema["$ref"].rsplit("/", 1)[-1]]
    assert code_schema["type"] == "string"
    assert set(code_schema["enum"]) == {
        "BAD_REQUEST",
        "NOT_FOUND",
        "METHOD_NOT_ALLOWED",
        "INTERNAL_SERVER_ERROR",
    }
    assert properties["detail"]["type"] == "string"
    assert properties["errors"]["type"] == "array"
    assert properties["errors"]["maxItems"] == 0
    bad_request_responses = document["paths"]["/errors/bad-request"]["get"]["responses"]
    assert (
        bad_request_responses["400"]["content"]["application/json"]["schema"]["$ref"]
        == error_ref
    )
    validation_responses = document["paths"]["/errors/input"]["post"]["responses"]
    validation_ref = validation_responses["422"]["content"]["application/json"][
        "schema"
    ]["$ref"]
    assert validation_ref != error_ref
    assert set(schemas[validation_ref.rsplit("/", 1)[-1]]["properties"]) == {"detail"}
    assert not {"400", "404", "405", "422"}.intersection(health_responses)
    assert all(
        str(status) in document["info"]["description"]
        for status in (400, 404, 405, 422, 500)
    )


def test_error_example_routes_are_absent_from_product_app() -> None:
    assert all(
        not path.startswith("/errors/") for path in create_app().openapi()["paths"]
    )
