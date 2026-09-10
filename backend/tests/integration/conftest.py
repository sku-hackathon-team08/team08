import os
from pathlib import Path

import pytest

from app.core.config import Settings
from app.main import create_app


@pytest.fixture(params=["sqlite", "postgresql"])
def database_settings(request: pytest.FixtureRequest, tmp_path: Path) -> Settings:
    if request.param == "sqlite":
        return Settings(
            _env_file=None, database_url=f"sqlite:///{tmp_path}/db/test.sqlite3"
        )
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("실제 PostgreSQL 검증에는 별도 TEST_DATABASE_URL이 필요합니다.")
    if not url.startswith("postgresql://") or not url.split("?", 1)[0].endswith(
        "/team08_test"
    ):
        pytest.fail("TEST_DATABASE_URL은 별도 PostgreSQL team08_test DB여야 합니다.")
    return Settings(_env_file=None, database_url=url)


@pytest.fixture(params=["sqlite", "postgres"])
async def festival(request, tmp_path):
    from uuid import UUID, uuid4

    from httpx import ASGITransport, AsyncClient
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from app.db.session import Database
    from app.models.base import Base
    from app.models.entry import Event
    from app.services.openai_analysis import Extraction

    url = f"sqlite:///{tmp_path}/festival.db"
    if request.param == "postgres":
        url = os.environ.get("TEST_DATABASE_URL")
        if not url:
            pytest.skip("별도 PostgreSQL 테스트 DB가 필요합니다.")
    app = create_app(Settings(_env_file=None, database_url=url))
    schema = "test_" + uuid4().hex

    class Provider:
        calls = 0
        fail = False

        async def transcribe(self, data, mime, filename):
            return "출입구에 사람이 몰려 있습니다."

        async def analyze(self, text):
            self.calls += 1
            if self.fail:
                raise RuntimeError("private-provider-error")
            return Extraction(summary="출입구 혼잡", type="CROWD", signals=["CROWDING"])

    async with app.router.lifespan_context(app):
        engine = app.state.database.engine
        if request.param == "postgres":
            async with engine.begin() as connection:
                await connection.execute(text(f"CREATE SCHEMA {schema}"))
            engine = engine.execution_options(schema_translate_map={None: schema})
            app.state.database = Database(
                engine, async_sessionmaker(engine, expire_on_commit=False)
            )
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with app.state.database.sessions() as db:
            db.add_all(
                [
                    Event(
                        name="서울 콘서트",
                        code="DEMO26",
                        map_id=UUID("69cbb93b-d6cb-5785-a7c8-e606c7279d3d"),
                    ),
                    Event(
                        name="다른 행사",
                        code="OTHER26",
                        map_id=UUID("69cbb93b-d6cb-5785-a7c8-e606c7279d3d"),
                    ),
                ]
            )
            await db.commit()
        app.state.analysis_provider = Provider()
        async with AsyncClient(
            transport=ASGITransport(app), base_url="http://test"
        ) as client:
            yield client, app
        if request.param == "postgres":
            async with engine.begin() as connection:
                await connection.execute(text(f"DROP SCHEMA {schema} CASCADE"))
