from typing import Literal
from uuid import UUID

from pydantic import Field

from app.schemas.base import ApiModel


class Position(ApiModel):
    lng: float = Field(ge=-180, le=180)
    lat: float = Field(ge=-90, le=90)


class Polygon(ApiModel):
    type: Literal["Polygon"]
    coordinates: list[list[tuple[float, float]]]


class Zone(ApiModel):
    id: UUID
    key: str
    name: str
    color: str
    area_square_meters: float
    geometry: Polygon


class Gate(ApiModel):
    id: UUID
    name: str
    position: Position
    zone_id: UUID | None


class ModelPlacement(ApiModel):
    uri: str
    position: Position
    heading_degrees: float
    meters_per_unit: float
    height_policy: str
    node_count: int
    component_count: int
    seat_markers: int


class DemoPoint(Position):
    zone_id: UUID
    surface_offset_meters: float


class DemoMapResponse(ApiModel):
    event_id: UUID
    name: str
    status: str
    data_version: str
    center: Position
    zones: list[Zone]
    gates: list[Gate]
    model: ModelPlacement
    demo_point: DemoPoint
