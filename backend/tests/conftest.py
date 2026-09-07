import pytest


@pytest.fixture
def anyio_backend() -> str:
    # 서버와 같은 asyncio 환경에서 검증하도록 테스트 실행 백엔드를 고정한다.
    return "asyncio"
