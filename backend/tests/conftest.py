import pytest


@pytest.fixture
def anyio_backend() -> str:
    # 서버와 동일한 asyncio 환경에서 검증하기 위한 실행 백엔드 고정.
    return "asyncio"
