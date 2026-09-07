import os
from pathlib import Path

import pytest

from app.core.config import Settings


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
