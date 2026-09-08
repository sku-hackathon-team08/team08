import subprocess
import sys
import traceback
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from app.core.config import Settings
from app.db.session import DatabaseShutdownError
from app.main import create_app


def test_log_level_settings_priority(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    dotenv = tmp_path / ".env"
    dotenv.write_text("LOG_LEVEL=WARNING\n")
    assert Settings(_env_file=dotenv).log_level == "WARNING"
    monkeypatch.setenv("LOG_LEVEL", "ERROR")
    assert Settings(_env_file=dotenv).log_level == "ERROR"
    assert Settings(_env_file=dotenv, log_level="DEBUG").log_level == "DEBUG"


@pytest.mark.anyio
async def test_repeated_app_lifespans_log_completed_database_work_once(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    settings = Settings(
        _env_file=None, database_url=f"sqlite:///{tmp_path}/test.sqlite3"
    )
    for _ in range(2):
        app = create_app(settings)
        async with app.router.lifespan_context(app):
            output = capsys.readouterr().err
            assert output.count("DB 연결 확인 완료 (sqlite)") == 1
            assert "DB 연결 풀 정리 완료" not in output
        output = capsys.readouterr().err
        assert output.count("DB 연결 풀 정리 완료") == 1
        assert str(tmp_path) not in output


@pytest.mark.anyio
async def test_error_level_hides_database_success_logs(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    settings = Settings(
        _env_file=None,
        database_url=f"sqlite:///{tmp_path}/test.sqlite3",
        log_level="ERROR",
    )
    app = create_app(settings)
    async with app.router.lifespan_context(app):
        pass
    assert capsys.readouterr().err == ""


@pytest.mark.anyio
async def test_cleanup_failure_is_safe_and_never_logged_as_completed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    settings = Settings(
        _env_file=None, database_url=f"sqlite:///{tmp_path}/test.sqlite3"
    )
    app = create_app(settings)
    with pytest.raises(DatabaseShutdownError) as caught:
        async with app.router.lifespan_context(app):
            engine = app.state.database.engine
            # 실제 연결을 정리한 뒤 드라이버 실패만 주입.
            await engine.dispose()
            monkeypatch.setattr(
                type(engine),
                "dispose",
                AsyncMock(side_effect=RuntimeError("private-secret")),
            )
    output = capsys.readouterr().err
    formatted = "".join(traceback.format_exception(caught.value))
    assert "DB 연결 풀 정리 완료" not in output
    assert "private-secret" not in formatted
    assert "RuntimeError" in formatted
    assert not hasattr(app.state, "database")


def test_uvicorn_records_startup_failure_once_without_private_path(
    tmp_path: Path,
) -> None:
    blocked = tmp_path / "private-secret"
    blocked.write_text("not a directory")
    # 별도 프로세스에서 Uvicorn의 실제 lifespan 오류 로그 확인. HTTP 서버는 열지 않음.
    script = f"""
import asyncio
import uvicorn
from uvicorn.lifespan.on import LifespanOn
from app.core.config import Settings
from app.main import create_app

async def check():
    settings = Settings(_env_file=None, database_url={f"sqlite:///{blocked}/db.sqlite3"!r})
    lifespan = LifespanOn(uvicorn.Config(create_app(settings), log_level='info'))
    await lifespan.startup()
    assert lifespan.should_exit

asyncio.run(check())
"""
    result = subprocess.run(
        [sys.executable, "-c", script], capture_output=True, text=True, timeout=15
    )
    assert result.returncode == 0, result.stderr
    assert result.stderr.count("DatabaseStartupError:") == 1
    assert "FileExistsError" in result.stderr
    assert "private-secret" not in result.stderr
    assert "DB 연결 확인 완료" not in result.stderr
    assert "ERROR" in result.stderr
