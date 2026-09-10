from typing import Annotated

import pytest
from fastapi import Header, Query
from httpx import ASGITransport, AsyncClient
from pydantic import ConfigDict, Field

from app.main import create_app
from app.schemas.base import ApiModel


class Child(ApiModel):
    model_config = ConfigDict(extra="forbid")
    display_name: str


class Document(ApiModel):
    model_config = ConfigDict(extra="forbid")
    children: list[Child]


@pytest.mark.anyio
async def test_nested_paths_and_unknown_fields_do_not_leak_values() -> None:
    app = create_app()

    @app.post("/validation")
    def accept(body: Document) -> Document:
        return body

    async with AsyncClient(
        transport=ASGITransport(app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/validation",
            json={
                "children": [
                    {"displayName": "ok"},
                    {"displayName": ["secret-value"], "unknownKey": "private-key"},
                ]
            },
        )
    assert response.status_code == 422
    errors = response.json()["errors"]
    assert [(error["path"], error["code"]) for error in errors] == [
        (["children", 1, "displayName"], "INVALID_TYPE"),
        (["children", 1, "unknownKey"], "UNKNOWN_FIELD"),
    ]
    assert all(error["location"] == "body" for error in errors)
    assert "secret-value" not in response.text
    assert "private-key" not in response.text
    assert not {"input", "ctx", "type", "loc"} & set(errors[0])


@pytest.mark.anyio
async def test_query_path_header_locations_and_missing_values() -> None:
    app = create_app()

    @app.get("/validation/{item_id}")
    def accept(
        item_id: int,
        page_size: Annotated[int, Query(alias="pageSize", ge=1)],
        token: Annotated[str, Header(alias="X-Token")],
    ) -> None:
        pass

    async with AsyncClient(
        transport=ASGITransport(app), base_url="http://test"
    ) as client:
        response = await client.get("/validation/no-number?pageSize=0")
    assert response.status_code == 422
    errors = response.json()["errors"]
    assert {
        (error["location"], tuple(error["path"]), error["code"]) for error in errors
    } == {
        ("path", ("item_id",), "INVALID_TYPE"),
        ("query", ("pageSize",), "INVALID_VALUE"),
        ("header", ("x-token",), "REQUIRED"),
    }


@pytest.mark.anyio
async def test_union_branch_labels_are_not_public_paths() -> None:
    class UnionInput(ApiModel):
        value: Annotated[int | str, Field()]

    app = create_app()

    @app.post("/validation")
    def accept(body: UnionInput) -> None:
        pass

    async with AsyncClient(
        transport=ASGITransport(app), base_url="http://test"
    ) as client:
        response = await client.post("/validation", json={"value": []})
    assert response.status_code == 422
    assert all(error["path"] == [] for error in response.json()["errors"])
