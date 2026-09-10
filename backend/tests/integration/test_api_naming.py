from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from pathlib import Path
from typing import Annotated

import pytest
from fastapi import FastAPI, Query
from httpx import ASGITransport, AsyncClient
from pydantic import ConfigDict, Field

from app.core.config import Settings
from app.main import create_app
from app.schemas.base import ApiModel


class Profile(ApiModel):
    # ignore/forbid는 경계 검증용 모델의 선택이며 전역 HTTP 정책이 아니다.
    model_config = ConfigDict(extra="ignore")

    display_name: str
    optional_count: int | None = None


class BodyRequest(ApiModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    display_name: str
    optional_count: int | None = None
    profile: Profile | None = None
    children: list[Profile] = Field(default_factory=list)
    metadata: dict[str, object] = Field(default_factory=dict)


class BodyResponse(ApiModel):
    id: int
    display_name: str
    optional_count: int | None = None
    profile: Profile | None = None
    children: list[Profile] = Field(default_factory=list)
    metadata: dict[str, object] = Field(default_factory=dict)


class QueryRequest(ApiModel):
    model_config = ConfigDict(extra="ignore")

    page_size: int
    sort_order: str | None = None
    id: int = 1


class QueryResponse(ApiModel):
    page_size: int
    sort_order: str | None = None
    id: int = 1


class ForbidBodyRequest(BodyRequest):
    model_config = ConfigDict(extra="forbid")


class ForbidQueryRequest(QueryRequest):
    model_config = ConfigDict(extra="forbid")


@dataclass
class NamingHarness:
    app: FastAPI
    client: AsyncClient
    bodies: list[BodyRequest] = field(default_factory=list)
    queries: list[QueryRequest] = field(default_factory=list)


@pytest.fixture
async def naming(tmp_path: Path) -> AsyncIterator[NamingHarness]:
    app = create_app(
        Settings(_env_file=None, database_url=f"sqlite:///{tmp_path}/naming.sqlite3")
    )
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        harness = NamingHarness(app=app, client=client)

        def body_response(payload: BodyRequest) -> BodyResponse:
            harness.bodies.append(payload)
            return BodyResponse.from_internal(
                id=payload.id,
                display_name=payload.display_name,
                optional_count=payload.optional_count,
                profile=payload.profile,
                children=payload.children,
                metadata=payload.metadata,
            )

        def query_response(params: QueryRequest) -> QueryResponse:
            harness.queries.append(params)
            return QueryResponse.from_internal(
                page_size=params.page_size, sort_order=params.sort_order, id=params.id
            )

        @app.post("/naming/body", response_model=BodyResponse)
        async def body(payload: BodyRequest) -> BodyResponse:
            return body_response(payload)

        @app.get("/naming/query", response_model=QueryResponse)
        async def query(params: Annotated[QueryRequest, Query()]) -> QueryResponse:
            return query_response(params)

        @app.post("/naming/forbid-body", response_model=BodyResponse)
        async def forbid_body(payload: ForbidBodyRequest) -> BodyResponse:
            return body_response(payload)

        @app.get("/naming/forbid-query", response_model=QueryResponse)
        async def forbid_query(
            params: Annotated[ForbidQueryRequest, Query()],
        ) -> QueryResponse:
            return query_response(params)

        @app.get("/naming/internal", response_model=BodyResponse)
        async def internal() -> BodyResponse:
            return BodyResponse.from_internal(
                id=1,
                display_name="internal",
                profile={"display_name": "nested", "optional_count": 2},
                children=[{"display_name": "child"}],
                metadata={"keep_this_key": {"nested_key": "snake_case_value"}},
            )

        async with app.router.lifespan_context(app):
            yield harness


@pytest.mark.anyio
async def test_camel_json_populates_internal_fields_and_preserves_data_keys(
    naming: NamingHarness,
) -> None:
    document = {
        "id": 3,
        "displayName": "outer",
        "optionalCount": 7,
        "profile": {"displayName": "inner", "optionalCount": 2},
        "children": [{"displayName": "first", "optionalCount": None}],
        "metadata": {"keep_this_key": {"nested_key": "snake_case_value"}},
    }
    response = await naming.client.post("/naming/body", json=document)

    assert response.status_code == 200
    assert response.json() == document
    payload = naming.bodies[0]
    assert payload.display_name == "outer"
    assert payload.profile is not None
    assert payload.profile.display_name == "inner"
    assert payload.children[0].display_name == "first"


@pytest.mark.anyio
@pytest.mark.parametrize(
    "document",
    [
        {"id": 1, "display_name": "ignored"},
        {"id": 1, "displayName": "outer", "profile": {"display_name": "ignored"}},
        {"id": 1, "displayName": "outer", "children": [{"display_name": "ignored"}]},
        {"id": 1, "displayName": [], "display_name": "valid"},
    ],
)
async def test_body_snake_name_does_not_supply_missing_or_invalid_camel_field(
    naming: NamingHarness, document: dict[str, object]
) -> None:
    response = await naming.client.post("/naming/body", json=document)

    assert response.status_code == 422
    # 공개 필드 경로가 camelCase 이름을 유지한다.
    assert response.json()["errors"][0]["path"][-1] == "displayName"
    assert naming.bodies == []


@pytest.mark.anyio
@pytest.mark.parametrize("reverse", [False, True])
async def test_body_mixed_names_use_camel_values_regardless_of_order(
    naming: NamingHarness, reverse: bool
) -> None:
    child = {
        "displayName": "nested",
        "display_name": "ignored",
        "optionalCount": 2,
        "optional_count": 99,
    }
    if reverse:
        child = dict(reversed(list(child.items())))
    document = {
        "id": 1,
        "displayName": "accepted",
        "display_name": "ignored",
        "optionalCount": 5,
        "optional_count": 99,
        "profile": child,
        "children": [child],
    }
    if reverse:
        document = dict(reversed(list(document.items())))
    response = await naming.client.post("/naming/body", json=document)

    assert response.status_code == 200
    result = response.json()
    assert result["displayName"] == "accepted"
    assert result["optionalCount"] == 5
    assert result["profile"] == {"displayName": "nested", "optionalCount": 2}
    assert result["children"] == [result["profile"]]


@pytest.mark.anyio
@pytest.mark.parametrize("explicit_null", [False, True])
async def test_body_snake_optional_does_not_replace_default_or_explicit_null(
    naming: NamingHarness, explicit_null: bool
) -> None:
    child: dict[str, object] = {"displayName": "nested", "optional_count": 99}
    document: dict[str, object] = {
        "id": 1,
        "displayName": "outer",
        "optional_count": 99,
        "profile": child,
        "children": [child],
    }
    if explicit_null:
        document["optionalCount"] = None
        child["optionalCount"] = None
    response = await naming.client.post("/naming/body", json=document)

    assert response.status_code == 200
    result = response.json()
    assert result["optionalCount"] is None
    assert result["profile"]["optionalCount"] is None
    assert result["children"][0]["optionalCount"] is None
    payload = naming.bodies[0]
    assert payload.profile is not None
    for model in (payload, payload.profile, payload.children[0]):
        assert ("optional_count" in model.model_fields_set) == explicit_null


@pytest.mark.anyio
async def test_camel_query_populates_internal_fields_and_keeps_id(
    naming: NamingHarness,
) -> None:
    response = await naming.client.get(
        "/naming/query", params={"pageSize": "20", "sortOrder": "desc", "id": "7"}
    )

    assert response.status_code == 200
    assert response.json() == {"pageSize": 20, "sortOrder": "desc", "id": 7}
    assert naming.queries[0].page_size == 20
    assert naming.queries[0].sort_order == "desc"


@pytest.mark.anyio
@pytest.mark.parametrize(
    "params",
    [{"page_size": "5"}, {"pageSize": "invalid", "page_size": "5"}],
)
async def test_query_snake_name_does_not_supply_missing_or_invalid_camel_field(
    naming: NamingHarness, params: dict[str, str]
) -> None:
    response = await naming.client.get("/naming/query", params=params)

    assert response.status_code == 422
    assert response.json()["errors"][0]["path"][-1] == "pageSize"
    assert naming.queries == []


@pytest.mark.anyio
@pytest.mark.parametrize("reverse", [False, True])
async def test_query_mixed_names_use_camel_values_regardless_of_order(
    naming: NamingHarness, reverse: bool
) -> None:
    params = [
        ("pageSize", "5"),
        ("page_size", "99"),
        ("sortOrder", "accepted"),
        ("sort_order", "ignored"),
    ]
    if reverse:
        params.reverse()
    response = await naming.client.get("/naming/query", params=tuple(params))

    assert response.status_code == 200
    assert response.json() == {"pageSize": 5, "sortOrder": "accepted", "id": 1}


@pytest.mark.anyio
async def test_query_snake_optional_preserves_default_and_unset_state(
    naming: NamingHarness,
) -> None:
    response = await naming.client.get(
        "/naming/query", params={"pageSize": "5", "sort_order": "ignored"}
    )

    assert response.status_code == 200
    assert response.json()["sortOrder"] is None
    assert "sort_order" not in naming.queries[0].model_fields_set


@pytest.mark.anyio
@pytest.mark.parametrize("extra_key", ["unknownKey", "display_name"])
async def test_body_unrecognized_key_handling_follows_request_model_policy(
    naming: NamingHarness, extra_key: str
) -> None:
    document = {"id": 1, "displayName": "accepted", extra_key: "extra"}
    ignored = await naming.client.post("/naming/body", json=document)
    forbidden = await naming.client.post("/naming/forbid-body", json=document)

    assert ignored.status_code == 200
    assert ignored.json()["displayName"] == "accepted"
    assert forbidden.status_code == 422
    assert any(item["code"] == "UNKNOWN_FIELD" for item in forbidden.json()["errors"])


@pytest.mark.anyio
@pytest.mark.parametrize("extra_key", ["unknownKey", "page_size"])
async def test_query_unrecognized_key_handling_follows_request_model_policy(
    naming: NamingHarness, extra_key: str
) -> None:
    params = {"pageSize": "5", extra_key: "99"}
    ignored = await naming.client.get("/naming/query", params=params)
    forbidden = await naming.client.get("/naming/forbid-query", params=params)

    assert ignored.status_code == 200
    assert ignored.json()["pageSize"] == 5
    assert forbidden.status_code == 422
    assert any(item["code"] == "UNKNOWN_FIELD" for item in forbidden.json()["errors"])


@pytest.mark.anyio
async def test_internal_response_uses_nested_aliases_and_preserves_data_keys(
    naming: NamingHarness,
) -> None:
    response = await naming.client.get("/naming/internal")

    assert response.status_code == 200
    assert response.json() == {
        "id": 1,
        "displayName": "internal",
        "optionalCount": None,
        "profile": {"displayName": "nested", "optionalCount": 2},
        "children": [{"displayName": "child", "optionalCount": None}],
        "metadata": {"keep_this_key": {"nested_key": "snake_case_value"}},
    }


@pytest.mark.anyio
async def test_openapi_matches_request_response_nested_and_query_names(
    naming: NamingHarness,
) -> None:
    response = await naming.client.get("/openapi.json")

    assert response.status_code == 200
    document = response.json()
    schemas = document["components"]["schemas"]
    endpoint = document["paths"]["/naming/body"]["post"]
    refs = [
        endpoint["requestBody"]["content"]["application/json"]["schema"]["$ref"],
        endpoint["responses"]["200"]["content"]["application/json"]["schema"]["$ref"],
    ]
    for ref in refs:
        schema = schemas[ref.rsplit("/", 1)[-1]]
        assert set(schema["properties"]) == {
            "id",
            "displayName",
            "optionalCount",
            "profile",
            "children",
            "metadata",
        }
        assert set(schema["required"]) == {"id", "displayName"}
        nested_ref = schema["properties"]["children"]["items"]["$ref"]
        nested = schemas[nested_ref.rsplit("/", 1)[-1]]
        assert set(nested["properties"]) == {"displayName", "optionalCount"}
    parameters = document["paths"]["/naming/query"]["get"]["parameters"]
    assert {parameter["name"] for parameter in parameters} == {
        "pageSize",
        "sortOrder",
        "id",
    }
    query_ref = document["paths"]["/naming/query"]["get"]["responses"]["200"][
        "content"
    ]["application/json"]["schema"]["$ref"]
    assert set(schemas[query_ref.rsplit("/", 1)[-1]]["properties"]) == {
        "pageSize",
        "sortOrder",
        "id",
    }


def test_naming_routes_are_absent_from_product_app() -> None:
    assert all(
        not path.startswith("/naming/") for path in create_app().openapi()["paths"]
    )
