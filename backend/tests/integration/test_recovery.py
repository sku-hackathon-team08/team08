from uuid import UUID, uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings
from app.main import create_app
from app.models.base import Base
from app.models.entry import Actor, Event, LoginSession
from app.models.reports import Analysis
from app.services.entry import token_digest


@pytest.mark.anyio
async def test_restart_preserves_session_and_marks_interrupted_analysis_failed(
    tmp_path,
):
    settings = Settings(_env_file=None, database_url=f"sqlite:///{tmp_path}/restart.db")
    ids = [uuid4(), uuid4(), uuid4()]
    token = "test-only-session-token"
    first = create_app(settings)
    async with first.router.lifespan_context(first):
        async with first.state.database.engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with first.state.database.sessions() as db:
            event = Event(
                name="행사",
                code="RESTART",
                map_id=UUID("69cbb93b-d6cb-5785-a7c8-e606c7279d3d"),
            )
            db.add(event)
            await db.flush()
            actor = Actor(event_id=event.id, role="STAFF", name="사용자", team="운영")
            db.add(actor)
            await db.flush()
            db.add(LoginSession(actor_id=actor.id, token_hash=token_digest(token)))
            for aid, status in zip(ids, ["PENDING", "PROCESSING", "READY"]):
                db.add(
                    Analysis(
                        id=aid,
                        event_id=event.id,
                        actor_id=actor.id,
                        input_method="TEXT",
                        status=status,
                        transcript_raw="원문",
                        content_suggested="요약" if status == "READY" else None,
                        type_suggested="OTHER" if status == "READY" else None,
                        urgency_suggested="NORMAL" if status == "READY" else None,
                    )
                )
            await db.commit()
    second = create_app(settings)
    async with (
        second.router.lifespan_context(second),
        AsyncClient(transport=ASGITransport(second), base_url="http://test") as client,
    ):
        headers = {"Authorization": "Bearer " + token}
        assert (
            await client.get("/api/v1/sessions/me", headers=headers)
        ).status_code == 200
        for aid in ids[:2]:
            response = await client.get(
                "/api/v1/report-analyses/" + str(aid), headers=headers
            )
            assert response.json()["status"] == "FAILED"
            assert response.json()["failureCode"] == "ANALYSIS_INTERRUPTED"
        assert (
            await client.get("/api/v1/report-analyses/" + str(ids[2]), headers=headers)
        ).json()["status"] == "READY"
