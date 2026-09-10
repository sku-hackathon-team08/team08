from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_session
from app.services.entry import Identity, authenticate
from app.services.errors import ServiceError

# 응답 본문 생성 후 세션을 닫아 백그라운드 AI 대기에 연결을 넘기지 않는다.
Db = Annotated[AsyncSession, Depends(get_session, scope="function")]


async def current_identity(request: Request, db: Db) -> Identity:
    headers = request.headers.getlist("authorization")
    if len(headers) != 1:
        raise ServiceError(401, "UNAUTHENTICATED", "행사에 먼저 진입해주세요.")
    scheme, _, token = headers[0].partition(" ")
    if scheme.lower() != "bearer" or not token or len(token) > 128:
        raise ServiceError(401, "UNAUTHENTICATED", "세션 정보를 확인해주세요.")
    return await authenticate(db, token)


CurrentIdentity = Annotated[Identity, Depends(current_identity)]


def require_role(identity: Identity, role: str) -> None:
    if identity.actor.role != role:
        raise ServiceError(403, "FORBIDDEN", "이 작업을 수행할 권한이 없습니다.")
