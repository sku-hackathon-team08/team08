from collections.abc import AsyncIterator
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings
from app.main import create_app
from app.models.base import Base
from app.models.entry import Event
from app.models.idempotency import IdempotencyRecord  # noqa: F401

MAP_ID = UUID("69cbb93b-d6cb-5785-a7c8-e606c7279d3d")


@pytest.fixture
async def entry(tmp_path: Path) -> AsyncIterator[AsyncClient]:
    app = create_app(
        Settings(_env_file=None, database_url=f"sqlite:///{tmp_path}/entry.db")
    )
    async with app.router.lifespan_context(app):
        async with app.state.database.engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with app.state.database.sessions() as db:
            db.add_all(
                [
                    Event(id=uuid4(), name="첫 행사", code="DEMO26", map_id=MAP_ID),
                    Event(id=uuid4(), name="둘째 행사", code="OTHER26", map_id=uuid4()),
                ]
            )
            await db.commit()
        async with AsyncClient(
            transport=ASGITransport(app), base_url="http://test"
        ) as client:
            yield client


@pytest.mark.anyio
async def test_shared_code_roles_and_fresh_identity_on_new_login(
    entry: AsyncClient,
) -> None:
    staff = await entry.post(
        "/api/v1/sessions",
        json={
            "eventCode": "DEMO26",
            "role": "STAFF",
            "name": "동명이인",
            "team": "운영",
        },
    )
    admin = await entry.post(
        "/api/v1/sessions",
        json={"eventCode": "DEMO26", "role": "ADMIN", "name": "동명이인"},
    )
    assert staff.status_code == admin.status_code == 201
    assert staff.json()["role"] == "STAFF"
    assert admin.json()["role"] == "ADMIN"
    assert staff.json()["actor"]["id"] != admin.json()["actor"]["id"]
    assert staff.json()["event"]["id"] == admin.json()["event"]["id"]
    assert staff.json()["expiresAt"] is None
    headers = {"Authorization": "Bearer " + staff.json()["token"]}
    for _ in range(2):
        me = await entry.get("/api/v1/sessions/me", headers=headers)
        assert me.status_code == 200
        assert me.json()["actor"]["id"] == staff.json()["actor"]["id"]
        assert "token" not in me.json()
    logout = await entry.delete("/api/v1/sessions/me", headers=headers)
    assert logout.status_code == 204 and not logout.content
    assert (await entry.get("/api/v1/sessions/me", headers=headers)).status_code == 401
    assert (
        await entry.get(
            "/api/v1/sessions/me",
            headers={"Authorization": "Bearer " + admin.json()["token"]},
        )
    ).status_code == 200


@pytest.mark.anyio
async def test_invalid_credentials_and_role_input(entry: AsyncClient) -> None:
    assert (await entry.get("/api/v1/sessions/me")).status_code == 401
    response = await entry.get(
        "/api/v1/sessions/me", headers={"Authorization": "Bearer invalid"}
    )
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert response.json()["code"] == "UNAUTHENTICATED"
    for body in [
        {"eventCode": "DEMO26", "role": "STAFF", "name": "이름"},
        {"eventCode": "DEMO26", "role": "ADMIN", "name": "이름", "team": None},
        {"eventCode": "DEMO26", "role": "OWNER", "name": "이름"},
        {"eventCode": "DEMO26", "role": "ADMIN", "name": "   "},
        {
            "eventCode": "DEMO26",
            "role": "ADMIN",
            "name": "이름",
            "actorId": str(uuid4()),
        },
    ]:
        assert (await entry.post("/api/v1/sessions", json=body)).status_code == 422
    assert (
        await entry.post(
            "/api/v1/sessions",
            json={"eventCode": "wrong", "role": "ADMIN", "name": "이름"},
        )
    ).status_code == 404


@pytest.mark.anyio
async def test_event_map_scope_and_unprepared_map(entry: AsyncClient) -> None:
    first = (
        await entry.post(
            "/api/v1/sessions",
            json={"eventCode": "DEMO26", "role": "ADMIN", "name": "이름"},
        )
    ).json()
    second = (
        await entry.post(
            "/api/v1/sessions",
            json={"eventCode": "OTHER26", "role": "ADMIN", "name": "이름"},
        )
    ).json()
    response = await entry.get(
        "/api/v1/events/current/map",
        headers={"Authorization": "Bearer " + first["token"]},
    )
    assert response.status_code == 200
    assert response.json()["eventId"] == first["event"]["id"]
    assert response.json()["demoPoint"]["lat"] == 37.5683536
    response = await entry.get(
        "/api/v1/events/current/map",
        headers={"Authorization": "Bearer " + second["token"]},
    )
    assert response.status_code == 409
    assert response.json()["code"] == "MAP_NOT_READY"
