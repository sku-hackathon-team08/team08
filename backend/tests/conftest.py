import pytest


@pytest.fixture
def anyio_backend() -> str:
    # 서버와 동일한 asyncio 환경에서 검증하기 위한 실행 백엔드 고정.
    return "asyncio"


@pytest.fixture(autouse=True)
def clear_database_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("database_url", raising=False)
    monkeypatch.delenv("DATABASE_CONNECT_TIMEOUT_SECONDS", raising=False)
    monkeypatch.delenv("database_connect_timeout_seconds", raising=False)
    for name in (
        "DATABASE_POOL_SIZE",
        "DATABASE_MAX_OVERFLOW",
        "DATABASE_POOL_TIMEOUT_SECONDS",
        "DATABASE_POOL_PRE_PING",
    ):
        monkeypatch.delenv(name, raising=False)
        monkeypatch.delenv(name.lower(), raising=False)
