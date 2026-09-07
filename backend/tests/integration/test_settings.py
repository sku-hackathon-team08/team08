from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from app.core.config import Settings
from app.main import create_app


def test_environment_overrides_dotenv_and_explicit_value_overrides_environment(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    dotenv = tmp_path / ".env"
    dotenv.write_text(
        "DATABASE_URL=postgresql://localhost/from_file\nUNRELATED=value\n"
    )
    assert (
        Settings(_env_file=dotenv)
        .database_url.get_secret_value()
        .endswith("/from_file")
    )
    monkeypatch.setenv("DATABASE_URL", "postgresql://localhost/from_environment")
    assert (
        Settings(_env_file=dotenv)
        .database_url.get_secret_value()
        .endswith("/from_environment")
    )
    assert (
        Settings(_env_file=dotenv, database_url="postgresql://localhost/explicit")
        .database_url.get_secret_value()
        .endswith("/explicit")
    )


def test_empty_environment_overrides_dotenv_with_sqlite(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    dotenv = tmp_path / ".env"
    dotenv.write_text("DATABASE_URL=postgresql://localhost/from_file\n")
    monkeypatch.setenv("DATABASE_URL", "")
    assert (
        Settings(_env_file=dotenv)
        .database_url.get_secret_value()
        .startswith("sqlite:///")
    )


def test_working_directory_does_not_change_sqlite_or_load_unrelated_dotenv(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # 프로젝트 .env와 분리해 작업 디렉터리가 경로 선택에 미치는 영향 확인.
    dotenv = tmp_path / "chosen.env"
    dotenv.write_text("DATABASE_URL=\n")
    (tmp_path / ".env").write_text("DATABASE_URL=postgresql://localhost/unrelated\n")
    before = Settings(_env_file=dotenv).database_url.get_secret_value()
    monkeypatch.chdir(tmp_path)
    after = Settings(_env_file=dotenv).database_url.get_secret_value()
    relative = Settings(_env_file=None, database_url="sqlite:///data/team08.sqlite3")
    assert before == after == relative.database_url.get_secret_value()
    assert not (tmp_path / "data").exists()


def test_absolute_sqlite_path_is_preserved_without_creating_file(
    tmp_path: Path,
) -> None:
    db_file = tmp_path / "isolated.sqlite3"
    settings = Settings(_env_file=None, database_url=f"sqlite:///{db_file.as_posix()}")
    assert settings.database_url.get_secret_value() == f"sqlite:///{db_file.as_posix()}"
    assert not db_file.exists()


@pytest.mark.anyio
async def test_apps_use_separate_injected_settings_without_opening_database(
    tmp_path: Path,
) -> None:
    first = Settings(_env_file=None, database_url=f"sqlite:///{tmp_path}/first.sqlite3")
    second = Settings(_env_file=None, database_url="postgresql://localhost/second")
    app_a = create_app(first)
    app_b = create_app(second)
    async with (
        app_a.router.lifespan_context(app_a),
        app_b.router.lifespan_context(app_b),
    ):
        assert app_a.state.settings is first
        assert app_b.state.settings is second
        async with AsyncClient(
            transport=ASGITransport(app=app_a), base_url="http://test"
        ) as client:
            response = await client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
    assert not (tmp_path / "first.sqlite3").exists()


@pytest.mark.anyio
async def test_startup_reads_environment_and_rejects_invalid_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    app = create_app()
    monkeypatch.setenv("DATABASE_URL", "postgresql://localhost/from_startup")
    async with app.router.lifespan_context(app):
        assert app.state.settings.database_url.get_secret_value().endswith(
            "/from_startup"
        )
    monkeypatch.setenv(
        "DATABASE_URL", "mysql://user:example-password@localhost/database"
    )
    with pytest.raises(ValidationError):
        async with app.router.lifespan_context(app):
            pytest.fail("Invalid configuration must prevent startup")
