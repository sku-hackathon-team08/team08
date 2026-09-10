import re
from datetime import datetime
from typing import Annotated, Literal, Self
from uuid import UUID

from pydantic import AfterValidator, BeforeValidator, ConfigDict, Field, model_validator

from app.schemas.base import ApiModel
from app.schemas.entry import nonblank


def uuid_input(value: object) -> object:
    if isinstance(value, str) and not re.fullmatch(
        r"[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}", value
    ):
        raise ValueError("하이픈 포함 UUID가 필요합니다.")
    return value


def timestamp(value: str) -> str:
    if not re.fullmatch(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})", value
    ) or value.endswith("-00:00"):
        raise ValueError("시간대가 있는 RFC 3339 시각이 필요합니다.")
    datetime.fromisoformat(value)
    return value


type ResourceId = Annotated[UUID, BeforeValidator(uuid_input)]
type ReportType = Literal["EMERGENCY", "FACILITY", "CROWD", "LOST", "OTHER"]
type Urgency = Literal["NORMAL", "CAUTION", "URGENT"]
type ReportStatus = Literal["RECEIVED", "IN_PROGRESS", "RESOLVED", "CANCELLED"]
type TextContent = Annotated[
    str, Field(strict=True, min_length=1), AfterValidator(nonblank)
]


class Input(ApiModel):
    model_config = ConfigDict(extra="forbid")


class Position(Input):
    lat: Annotated[float, Field(strict=True, ge=-90, le=90, allow_inf_nan=False)]
    lng: Annotated[float, Field(strict=True, ge=-180, le=180, allow_inf_nan=False)]
    captured_at: Annotated[str, AfterValidator(timestamp)]
    accuracy_meters: (
        Annotated[float, Field(strict=True, ge=0, allow_inf_nan=False)] | None
    )


class StaffIntake(Input):
    analysis_id: ResourceId
    content_final: TextContent
    type: ReportType
    urgency: Urgency
    position: Position


class AdminIntake(Input):
    analysis_id: ResourceId
    content_final: TextContent
    type: ReportType
    position: Position


class VersionInput(Input):
    expected_version: Annotated[int, Field(strict=True, ge=1)]


class ClaimInput(VersionInput):
    type: ReportType
    urgency: Urgency


class ClassificationInput(VersionInput):
    type: ReportType | None = None
    urgency: Urgency | None = None

    @model_validator(mode="after")
    def present_value(self) -> Self:
        if not {"type", "urgency"} & self.model_fields_set:
            raise ValueError("변경할 분류가 필요합니다.")
        if any(
            getattr(self, key) is None
            for key in self.model_fields_set & {"type", "urgency"}
        ):
            raise ValueError("분류에 null을 사용할 수 없습니다.")
        return self


class ResolveInput(VersionInput):
    resolve_note: str | None = None


class CancelInput(VersionInput):
    cancel_reason: TextContent


class ActorView(ApiModel):
    id: UUID
    name: str


class Classification[T](ApiModel):
    value: T
    source: Literal["AI_SUGGESTED", "STAFF_EDITED", "ADMIN_SELECTED", "ADMIN_CONFIRMED"]
    confirmed_by: ActorView | None
    confirmed_at: str | None


class ZoneSummary(ApiModel):
    id: UUID
    name: str


class StaffReport(ApiModel):
    id: UUID
    content_final: str
    type: Classification[ReportType]
    urgency: Classification[Urgency]
    status: ReportStatus
    position: Position
    zone: ZoneSummary | None
    created_at: str
    claimed_by: ActorView | None
    claimed_at: str | None
    resolved_at: str | None
    cancelled_at: str | None


class ReportCard(ApiModel):
    id: UUID
    version: int
    content_final: str
    type: Classification[ReportType]
    urgency: Classification[Urgency]
    status: ReportStatus
    position: Position
    position_source: Literal["DEMO_FIXED", "MAP_SELECTED"]
    zone: ZoneSummary | None
    created_at: str
    claimed_by: ActorView | None
    claimed_at: str | None
    is_unacknowledged: bool
    support_request_id: UUID | None
    active_supporter_count: int


class ReportDetail(ReportCard):
    reporter: ActorView
    input_method: Literal["VOICE", "TEXT"]
    transcript_raw: str
    content_suggested: str
    type_suggested: ReportType
    urgency_suggested: Urgency
    resolved_at: str | None
    resolve_note: str | None
    cancelled_at: str | None
    cancelled_by: ActorView | None
    cancel_reason: str | None


class Page[T](ApiModel):
    items: list[T]
    next_cursor: str | None
    as_of: str


class MapPin(ApiModel):
    id: UUID
    version: int
    position: Position
    status: ReportStatus
    type: Classification[ReportType]
    urgency: Classification[Urgency]
    is_unacknowledged: bool


class Change(ApiModel):
    field: str
    before: object
    after: object


class Log(ApiModel):
    id: UUID
    action: str
    actor: ActorView
    occurred_at: str
    changes: list[Change]
    note: str | None


class SupportRequestView(ApiModel):
    id: UUID
    report_id: UUID
    opened_by: ActorView
    opened_at: str
    closed_at: str | None
    close_reason: (
        Literal["MANUAL", "REPORT_RELEASED", "REPORT_RESOLVED", "REPORT_CANCELLED"]
        | None
    )


class ParticipationView(ApiModel):
    id: UUID
    support_request_id: UUID
    actor: ActorView
    joined_at: str
    ended_at: str | None
    end_reason: Literal["SELF_CANCELLED", "REQUEST_CLOSED"] | None


class SupportResult(ApiModel):
    support_request: SupportRequestView
    report_version: int


class ParticipationResult(ApiModel):
    participation: ParticipationView
    report_version: int
