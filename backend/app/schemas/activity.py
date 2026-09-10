from typing import Literal
from uuid import UUID

from pydantic import Field

from app.schemas.base import ApiModel
from app.schemas.entry import ActorSummary
from app.schemas.reports import (
    Change,
    ReportStatus,
    ReportType,
    StaffReport,
    ZoneSummary,
)


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


class AdminActivitySummary(ApiModel):
    total_reports: int
    total_actions: int
    claimed: int
    released: int
    classification_changed: int
    resolved: int
    cancelled: int
    average_processing_seconds: float | None


class AdminActivityItem(ApiModel):
    id: UUID
    report_id: UUID
    action: Literal[
        "REPORT_CLAIMED",
        "ASSIGNMENT_RELEASED",
        "CLASSIFICATION_CHANGED",
        "REPORT_RESOLVED",
        "REPORT_CANCELLED",
    ]
    occurred_at: str
    changes: list[Change]
    note: str | None
    content_final: str
    current_type: ReportType
    current_status: ReportStatus
    zone: ZoneSummary | None
    created_at: str
    processing_seconds: float | None


class AdminActivityReport(ApiModel):
    actor: ActorSummary
    range: ActivityRange
    summary: AdminActivitySummary
    type_distribution: list[TypeCount]
    items: list[AdminActivityItem]
    next_cursor: str | None
    as_of: str
