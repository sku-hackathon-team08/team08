import json
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings
from app.main import create_app

ASSETS = Path(__file__).resolve().parents[2] / "demo" / "assets"
SEED = json.loads((ASSETS / "seoul-worldcup.json").read_text())
BASE = f"/api/v1/demo/events/{SEED['eventId']}"


@pytest.mark.anyio
async def test_event_map_and_owned_assets(tmp_path: Path) -> None:
    app = create_app(
        Settings(_env_file=None, database_url=f"sqlite:///{tmp_path}/db.sqlite3")
    )
    async with (
        app.router.lifespan_context(app),
        AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client,
    ):
        response = await client.get(f"{BASE}/map")
        assert response.status_code == 200
        assert response.json() == SEED
        assert response.json()["demoPoint"]["zoneId"] in {
            z["id"] for z in SEED["zones"]
        }
        for filename in [
            "concert.glb",
            "concert-zones.geojson",
            "concert-coordinates.csv",
        ]:
            asset = await client.get(f"{BASE}/assets/{filename}")
            assert asset.status_code == 200
            assert asset.content == (ASSETS / filename).read_bytes()
        assert (await client.get(SEED["model"]["uri"])).content.startswith(b"glTF")


@pytest.mark.anyio
async def test_unknown_event_and_unlisted_assets_are_not_served(tmp_path: Path) -> None:
    app = create_app(
        Settings(_env_file=None, database_url=f"sqlite:///{tmp_path}/db.sqlite3")
    )
    unknown = "/api/v1/demo/events/00000000-0000-0000-0000-000000000000"
    async with (
        app.router.lifespan_context(app),
        AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client,
    ):
        for suffix in ["map", "assets/concert.glb"]:
            response = await client.get(f"{unknown}/{suffix}")
            assert response.status_code == 404
            assert response.json()["code"] == "NOT_FOUND"
        assert (await client.get(f"{BASE}/assets/.env")).status_code == 422
        assert (await client.get("/api/v1/events/current/map")).status_code == 404
