from pathlib import Path

import pytest
from pydantic import ValidationError

from app.core.config import Settings


@pytest.mark.parametrize("value", ["", " ", "\t"])
def test_blank_database_url_uses_file_sqlite(value: str) -> None:
    settings = Settings(_env_file=None, database_url=value)
    expected_path = Path(__file__).resolve().parents[2] / "data/team08.sqlite3"
    assert (
        settings.database_url.get_secret_value()
        == f"sqlite:///{expected_path.as_posix()}"
    )


def test_missing_database_url_uses_file_sqlite() -> None:
    settings = Settings(_env_file=None)
    expected_path = Path(__file__).resolve().parents[2] / "data/team08.sqlite3"
    assert (
        settings.database_url.get_secret_value()
        == f"sqlite:///{expected_path.as_posix()}"
    )


@pytest.mark.parametrize("scheme", ["postgres", "postgresql"])
def test_postgresql_url_replaces_sqlite_default(scheme: str) -> None:
    settings = Settings(
        _env_file=None,
        database_url=f"{scheme}://user:example-password@localhost:5432/team08?sslmode=require",
    )
    assert settings.database_url.get_secret_value() == (
        "postgresql://user:example-password@localhost:5432/team08?sslmode=require"
    )


@pytest.mark.parametrize(
    "url",
    [
        "not-a-url",
        "postgresql://local\nhost/team08",
        "sqlite:///bad\x00name.db",
        "mysql://user:example-password@localhost/team08",
        "postgresql:///team08",
        "postgresql://localhost",
        "postgresql://localhost/",
        "postgresql://localhost:bad/team08",
        "postgresql://localhost:99999/team08",
        "postgresql://user:example-password@[invalid/team08",
        "postgresql://localhost/team08#fragment",
        "sqlite://remote/team08.db",
        "sqlite:///",
        "sqlite:///:memory:",
        "sqlite:///data/",
        "sqlite:///team08.db?mode=ro",
    ],
)
def test_invalid_database_url_fails_without_fallback(url: str) -> None:
    with pytest.raises(ValidationError, match="DATABASE_URL"):
        Settings(_env_file=None, database_url=url)


def test_settings_display_masks_database_password() -> None:
    password = "example-private-password"
    settings = Settings(
        _env_file=None, database_url=f"postgresql://user:{password}@localhost/team08"
    )
    for output in (str(settings), repr(settings), settings.model_dump_json()):
        assert password not in output


def test_validation_error_display_hides_database_password() -> None:
    password = "example-private-password"
    with pytest.raises(ValidationError) as exc:
        Settings(
            _env_file=None,
            database_url=f"postgresql://user:{password}@localhost:bad/team08",
        )
    assert password not in str(exc.value)
    assert password not in repr(exc.value)


@pytest.mark.parametrize("timeout", [0, -1, 121, float("inf"), float("nan")])
def test_database_connection_timeout_requires_finite_positive_limit(
    timeout: float,
) -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, database_connect_timeout_seconds=timeout)
