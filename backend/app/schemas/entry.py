from typing import Annotated, Literal, Self
from uuid import UUID

from pydantic import AfterValidator, ConfigDict, Field, model_validator

from app.schemas.base import ApiModel


def nonblank(value: str) -> str:
    if not value.strip():
        raise ValueError("필수 문자열이 비어 있습니다.")
    return value


type Name = Annotated[
    str, Field(strict=True, min_length=1, max_length=100), AfterValidator(nonblank)
]
type Role = Literal["STAFF", "ADMIN"]


class SessionInput(ApiModel):
    model_config = ConfigDict(extra="forbid")
    event_code: Annotated[
        str, Field(strict=True, min_length=1, max_length=64), AfterValidator(nonblank)
    ]
    role: Role
    name: Name
    team: Name | None = None

    @model_validator(mode="after")
    def validate_team(self) -> Self:
        if self.role == "STAFF" and self.team is None:
            raise ValueError("스태프는 소속 팀이 필요합니다.")
        if self.role == "ADMIN" and "team" in self.model_fields_set:
            raise ValueError("관리자는 소속 팀을 전송하지 않습니다.")
        return self


class ActorSummary(ApiModel):
    id: UUID
    name: str
    team: str | None


class EventSummary(ApiModel):
    id: UUID
    name: str


class SessionInfo(ApiModel):
    role: Role
    event: EventSummary
    actor: ActorSummary
    expires_at: None = None


class SessionCreated(SessionInfo):
    token: str
