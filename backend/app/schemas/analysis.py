from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field

from app.schemas.base import ApiModel
from app.schemas.reports import Input, ReportType, TextContent, Urgency


class AnalysisInput(Input):
    input_method: Literal["TEXT"]
    text: Annotated[TextContent, Field(max_length=5000)]


class AnalysisCreated(ApiModel):
    id: UUID
    status: Literal["PENDING"] = "PENDING"


class AnalysisView(ApiModel):
    id: UUID
    status: Literal["PENDING", "PROCESSING", "READY", "FAILED"]
    transcript_raw: str | None
    content_suggested: str | None
    type_suggested: ReportType | None
    urgency_suggested: Urgency | None
    expires_at: None = None
    failure_code: str | None
