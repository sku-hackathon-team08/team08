from typing import Literal

from pydantic import Field

from app.schemas.base import ApiModel
from app.schemas.entry import ActorSummary
from app.schemas.reports import ReportType, StaffReport


class ActivityRange(ApiModel):
    start: str | None = Field(alias="from")
    end: str | None = Field(alias="to")
    time_zone: Literal["Asia/Seoul"]


class ActivitySummary(ApiModel):
    total: int
    resolved: int
    cancelled: int
    average_processing_seconds: float | None


class TypeCount(ApiModel):
    type: ReportType
    count: int


class ActivityReport(ApiModel):
    actor: ActorSummary
    range: ActivityRange
    summary: ActivitySummary
    type_distribution: list[TypeCount]
    items: list[StaffReport]
    next_cursor: str | None
    as_of: str


class DashboardStats(ApiModel):
    total: int
    unacknowledged: int
    in_progress: int
    resolved: int
    as_of: str
