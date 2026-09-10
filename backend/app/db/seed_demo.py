"""준비된 데모 행사를 한 번 등록. 기존 행사·사용자·신고는 변경하지 않는다."""

import asyncio
from uuid import UUID

from sqlalchemy import select

from app.core.config import Settings
from app.db.session import open_database
from app.models.entry import Event
from app.repositories.demo_maps import get_demo_map


async def seed() -> None:
    map_id = UUID("69cbb93b-d6cb-5785-a7c8-e606c7279d3d")
    data = get_demo_map(map_id)
    assert data is not None
    async with open_database(Settings()) as database:
        async with database.sessions() as db:
            event = await db.scalar(select(Event).where(Event.code == "DEMO26"))
            if event is None:
                event = Event(name=data.name, code="DEMO26", map_id=map_id)
                db.add(event)
                await db.commit()
            print(f"데모 행사 준비 완료: {event.id} / 코드 DEMO26")


if __name__ == "__main__":
    asyncio.run(seed())
