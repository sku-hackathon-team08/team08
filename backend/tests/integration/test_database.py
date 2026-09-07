import asyncio
from pathlib import Path
from typing import Annotated

import pytest
from fastapi import Depends
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.exc import TimeoutError as PoolTimeoutError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_session
from app.core.config import Settings
from app.db.session import DatabaseStartupError, open_database
from app.main import create_app


@pytest.mark.anyio
async def test_database_connects_and_closes_pool_after_exception(
    database_settings: Settings,
) -> None:
    closed: list[object] = []

    def on_close(connection: object, record: object) -> None:
        closed.append(connection)

    with pytest.raises(RuntimeError, match="application failure"):
        async with open_database(database_settings) as database:
            event.listen(database.engine.sync_engine, "close", on_close)
            async with database.sessions() as session:
                assert await session.scalar(text("SELECT 1")) == 1
                if database_settings.database_url.get_secret_value().startswith(
                    "postgresql:"
                ):
                    version = await session.scalar(text("SELECT version()"))
                    assert str(version).startswith("PostgreSQL")
            raise RuntimeError("application failure")
    assert closed


@pytest.mark.anyio
async def test_session_dependency_releases_and_does_not_commit(
    database_settings: Settings,
) -> None:
    app = create_app(database_settings)

    @app.post("/test-write")
    async def write(
        session: Annotated[AsyncSession, Depends(get_session)],
    ) -> dict[str, bool]:
        await session.execute(text("INSERT INTO pending_write (id) VALUES (1)"))
        return {"ok": True}

    @app.post("/test-failure")
    async def fail(session: Annotated[AsyncSession, Depends(get_session)]) -> None:
        await session.execute(text("INSERT INTO pending_write (id) VALUES (2)"))
        raise RuntimeError("expected test failure")

    async with app.router.lifespan_context(app):
        async with app.state.database.engine.begin() as connection:
            await connection.execute(
                text("CREATE TEMP TABLE pending_write (id INTEGER PRIMARY KEY)")
            )
        async with AsyncClient(
            transport=ASGITransport(app=app, raise_app_exceptions=False),
            base_url="http://test",
        ) as client:
            assert (await client.post("/test-write")).status_code == 200
            assert (await client.post("/test-failure")).status_code == 500
        async with app.state.database.sessions() as session:
            assert await session.scalar(text("SELECT count(*) FROM pending_write")) == 0
    assert not hasattr(app.state, "database")


@pytest.mark.anyio
async def test_sqlite_file_created_and_data_survives_restart(tmp_path: Path) -> None:
    path = tmp_path / "new-directory" / "test.sqlite3"
    settings = Settings(_env_file=None, database_url=f"sqlite:///{path}")
    app = create_app(settings)
    assert not path.exists()
    async with app.router.lifespan_context(app):
        assert path.is_file()
        async with app.state.database.engine.begin() as connection:
            assert (
                await connection.scalar(
                    text("SELECT count(*) FROM sqlite_master WHERE type='table'")
                )
                == 0
            )
            await connection.execute(
                text("CREATE TABLE retained (id INTEGER PRIMARY KEY)")
            )
            await connection.execute(text("INSERT INTO retained VALUES (1)"))
    async with app.router.lifespan_context(app):
        async with app.state.database.sessions() as session:
            assert await session.scalar(text("SELECT id FROM retained")) == 1


@pytest.mark.anyio
async def test_sqlite_foreign_keys_enforced_on_every_new_connection(
    tmp_path: Path,
) -> None:
    settings = Settings(_env_file=None, database_url=f"sqlite:///{tmp_path}/fk.sqlite3")
    async with open_database(settings) as database:
        async with database.engine.begin() as connection:
            await connection.execute(
                text("CREATE TABLE parent (id INTEGER PRIMARY KEY)")
            )
            await connection.execute(
                text("CREATE TABLE child (parent_id INTEGER REFERENCES parent(id))")
            )
        for _ in range(2):
            async with database.sessions() as session:
                assert await session.scalar(text("PRAGMA foreign_keys")) == 1
                with pytest.raises(IntegrityError):
                    await session.execute(text("INSERT INTO child VALUES (999)"))
            await database.engine.dispose()


@pytest.mark.anyio
async def test_sqlite_unwritable_location_stops_startup(tmp_path: Path) -> None:
    blocked_parent = tmp_path / "file-not-directory"
    blocked_parent.write_text("keep")
    settings = Settings(
        _env_file=None, database_url=f"sqlite:///{blocked_parent}/db.sqlite3"
    )
    with pytest.raises(DatabaseStartupError, match="FileExistsError"):
        async with open_database(settings):
            pytest.fail("Startup must fail")
    assert blocked_parent.read_text() == "keep"


@pytest.mark.anyio
async def test_postgres_connection_failure_is_safe_and_never_creates_sqlite(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    server = await asyncio.start_server(
        lambda reader, writer: writer.close(), "127.0.0.1", 0
    )
    port = server.sockets[0].getsockname()[1]
    settings = Settings(
        _env_file=None,
        database_url=f"postgresql://user:private-test-secret@127.0.0.1:{port}/team08_test",
    )
    async with server:
        with pytest.raises(DatabaseStartupError) as exc:
            async with open_database(settings):
                pytest.fail("Startup must fail")
    assert "private-test-secret" not in str(exc.value)
    assert "OperationalError" in str(exc.value)
    assert not list(tmp_path.iterdir())


@pytest.mark.anyio
async def test_postgres_connection_timeout_is_bounded(tmp_path: Path) -> None:
    writers: list[asyncio.StreamWriter] = []

    async def stall(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        writers.append(writer)

    server = await asyncio.start_server(stall, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    settings = Settings(
        _env_file=None,
        database_url=f"postgresql://user:private-test-secret@127.0.0.1:{port}/team08_test",
        database_connect_timeout_seconds=0.1,
    )
    try:
        async with asyncio.timeout(5):
            with pytest.raises(DatabaseStartupError, match="초과"):
                async with open_database(settings):
                    pytest.fail("Startup must time out")
    finally:
        server.close()
        for writer in writers:
            writer.close()
            await writer.wait_closed()
        await server.wait_closed()
    assert not list(tmp_path.iterdir())


@pytest.mark.anyio
async def test_pool_limits_connections_and_reuses_them_after_timeout(
    database_settings: Settings,
) -> None:
    settings = Settings(
        _env_file=None,
        database_url=database_settings.database_url,
        database_pool_size=1,
        database_max_overflow=1,
        database_pool_timeout_seconds=0.05,
    )
    async with open_database(settings) as database:
        async with database.engine.connect() as first:
            async with database.engine.connect() as overflow:
                assert await first.scalar(text("SELECT 1")) == 1
                assert await overflow.scalar(text("SELECT 1")) == 1
                with pytest.raises(PoolTimeoutError):
                    async with database.engine.connect():
                        pytest.fail("Pool must enforce its two-connection limit")
            async with database.engine.connect() as released:
                assert await released.scalar(text("SELECT 1")) == 1
