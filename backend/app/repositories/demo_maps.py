"""Backend-owned, read-only seed data for the public concert demo."""

from pathlib import Path
from typing import Literal
from uuid import UUID

from app.schemas.demo_map import DemoMapResponse

ASSET_DIRECTORY = Path(__file__).resolve().parents[2] / "demo" / "assets"
type AssetName = Literal[
    "concert.glb", "concert-zones.geojson", "concert-coordinates.csv"
]


def get_demo_map(event_id: UUID) -> DemoMapResponse | None:
    data = DemoMapResponse.model_validate_json(
        (ASSET_DIRECTORY / "seoul-worldcup.json").read_text(encoding="utf-8")
    )
    return data if data.event_id == event_id else None


def get_demo_asset(event_id: UUID, asset_name: AssetName) -> Path | None:
    if get_demo_map(event_id) is None:
        return None
    return ASSET_DIRECTORY / asset_name
