from uuid import UUID, uuid4

from sqlalchemy import JSON, ForeignKey, Index, String, Text, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Analysis(Base):
    __tablename__ = "analyses"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    event_id: Mapped[UUID] = mapped_column(ForeignKey("events.id"), index=True)
    actor_id: Mapped[UUID] = mapped_column(ForeignKey("actors.id"), index=True)
    input_method: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16), default="PENDING")
    transcript_raw: Mapped[str | None] = mapped_column(Text)
    content_suggested: Mapped[str | None] = mapped_column(Text)
    type_suggested: Mapped[str | None] = mapped_column(String(16))
    urgency_suggested: Mapped[str | None] = mapped_column(String(16))
    failure_code: Mapped[str | None] = mapped_column(String(32))


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    event_id: Mapped[UUID] = mapped_column(ForeignKey("events.id"), index=True)
    reporter_id: Mapped[UUID] = mapped_column(ForeignKey("actors.id"), index=True)
    analysis_id: Mapped[UUID] = mapped_column(ForeignKey("analyses.id"), unique=True)
    version: Mapped[int] = mapped_column(default=1)
    content_final: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default="RECEIVED")
    type_value: Mapped[str] = mapped_column(String(16))
    urgency_value: Mapped[str] = mapped_column(String(16))
    type_source: Mapped[str] = mapped_column(String(32))
    urgency_source: Mapped[str] = mapped_column(String(32))
    type_confirmed_by: Mapped[UUID | None] = mapped_column(ForeignKey("actors.id"))
    urgency_confirmed_by: Mapped[UUID | None] = mapped_column(ForeignKey("actors.id"))
    type_confirmed_at: Mapped[str | None] = mapped_column(String(24))
    urgency_confirmed_at: Mapped[str | None] = mapped_column(String(24))
    position: Mapped[dict] = mapped_column(JSON)
    position_source: Mapped[str] = mapped_column(String(16))
    zone: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[str] = mapped_column(String(24), index=True)
    claimed_by: Mapped[UUID | None] = mapped_column(ForeignKey("actors.id"))
    claimed_at: Mapped[str | None] = mapped_column(String(24))
    resolved_at: Mapped[str | None] = mapped_column(String(24))
    resolve_note: Mapped[str | None] = mapped_column(Text)
    cancelled_at: Mapped[str | None] = mapped_column(String(24))
    cancelled_by: Mapped[UUID | None] = mapped_column(ForeignKey("actors.id"))
    cancel_reason: Mapped[str | None] = mapped_column(Text)


class ReportLog(Base):
    __tablename__ = "report_logs"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    report_id: Mapped[UUID] = mapped_column(ForeignKey("reports.id"), index=True)
    actor_id: Mapped[UUID] = mapped_column(ForeignKey("actors.id"))
    occurred_at: Mapped[str] = mapped_column(String(24))
    action: Mapped[str] = mapped_column(String(40))
    changes: Mapped[list] = mapped_column(JSON)
    note: Mapped[str | None] = mapped_column(Text)


class SupportRequest(Base):
    __tablename__ = "support_requests"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    report_id: Mapped[UUID] = mapped_column(ForeignKey("reports.id"), index=True)
    opened_by: Mapped[UUID] = mapped_column(ForeignKey("actors.id"))
    opened_at: Mapped[str] = mapped_column(String(24))
    closed_at: Mapped[str | None] = mapped_column(String(24))
    close_reason: Mapped[str | None] = mapped_column(String(32))


class Participation(Base):
    __tablename__ = "participations"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    support_request_id: Mapped[UUID] = mapped_column(
        ForeignKey("support_requests.id"), index=True
    )
    actor_id: Mapped[UUID] = mapped_column(ForeignKey("actors.id"))
    joined_at: Mapped[str] = mapped_column(String(24))
    ended_at: Mapped[str | None] = mapped_column(String(24))
    end_reason: Mapped[str | None] = mapped_column(String(32))


Index(
    "uq_active_support_report",
    SupportRequest.report_id,
    unique=True,
    sqlite_where=text("closed_at IS NULL"),
    postgresql_where=text("closed_at IS NULL"),
)
Index(
    "uq_active_participation_actor",
    Participation.support_request_id,
    Participation.actor_id,
    unique=True,
    sqlite_where=text("ended_at IS NULL"),
    postgresql_where=text("ended_at IS NULL"),
)
