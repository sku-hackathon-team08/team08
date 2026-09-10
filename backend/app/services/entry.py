import hashlib
import secrets
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entry import Actor, Event, LoginSession
from app.schemas.entry import (
    ActorSummary,
    EventSummary,
    SessionCreated,
    SessionInfo,
    SessionInput,
)
from app.services.errors import ServiceError


@dataclass(frozen=True)
class Identity:
    actor: Actor
    event: Event
    session: LoginSession

    def info(self) -> SessionInfo:
        return SessionInfo.from_internal(
            role=self.actor.role,
            event=EventSummary.from_internal(id=self.event.id, name=self.event.name),
            actor=ActorSummary.from_internal(
                id=self.actor.id, name=self.actor.name, team=self.actor.team
            ),
        )


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def create_session(db: AsyncSession, data: SessionInput) -> SessionCreated:
    event = await db.scalar(select(Event).where(Event.code == data.event_code))
    if event is None:
        raise ServiceError(404, "NOT_FOUND", "행사 코드를 확인해주세요.")
    actor = Actor(event_id=event.id, role=data.role, name=data.name, team=data.team)
    db.add(actor)
    await db.flush()
    token = secrets.token_urlsafe(32)
    session = LoginSession(actor_id=actor.id, token_hash=token_digest(token))
    db.add(session)
    await db.commit()
    info = Identity(actor, event, session).info()
    return SessionCreated.from_internal(**info.model_dump(by_alias=False), token=token)


async def authenticate(db: AsyncSession, token: str) -> Identity:
    row = (
        await db.execute(
            select(LoginSession, Actor, Event)
            .join(Actor, LoginSession.actor_id == Actor.id)
            .join(Event, Actor.event_id == Event.id)
            .where(
                LoginSession.token_hash == token_digest(token),
                LoginSession.revoked.is_(False),
            )
        )
    ).first()
    if row is None:
        raise ServiceError(401, "UNAUTHENTICATED", "다시 진입해주세요.")
    session, actor, event = row
    return Identity(actor, event, session)
