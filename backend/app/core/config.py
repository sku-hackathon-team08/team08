from pathlib import Path
from urllib.parse import urlsplit

from pydantic import Field, PostgresDsn, SecretStr, ValidationError, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATABASE_URL = f"sqlite:///{(BACKEND_ROOT / 'data/team08.sqlite3').as_posix()}"


class Settings(BaseSettings):
    """환경 설정과 DB 연결 대상. 실제 연결은 DB 레이어에서 수행."""

    model_config = SettingsConfigDict(
        env_file=BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
        hide_input_in_errors=True,
        frozen=True,
    )

    database_url: SecretStr = Field(
        default=SecretStr(DEFAULT_DATABASE_URL), validation_alias="DATABASE_URL"
    )

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: SecretStr) -> SecretStr:
        url = value.get_secret_value().strip()
        if not url:
            return SecretStr(DEFAULT_DATABASE_URL)

        if any(ord(character) < 32 for character in url):
            raise ValueError("DATABASE_URL에는 제어 문자를 사용할 수 없습니다.")

        # 파서 오류에 원본 연결 문자열이 포함되지 않도록 안전한 메시지로 변환.
        try:
            parsed = urlsplit(url)
        except ValueError:
            raise ValueError("DATABASE_URL의 URL 형식이 올바르지 않습니다.") from None

        if parsed.scheme in {"postgres", "postgresql"}:
            try:
                dsn = PostgresDsn(url)
            except ValidationError:
                raise ValueError(
                    "DATABASE_URL의 PostgreSQL 연결 형식이 올바르지 않습니다."
                ) from None
            if not dsn.path or dsn.path == "/" or parsed.fragment:
                raise ValueError(
                    "DATABASE_URL에 DB 이름이 필요하며 #은 허용하지 않습니다."
                )
            return SecretStr("postgresql:" + url.split(":", 1)[1])

        if parsed.scheme == "sqlite":
            if (
                not url.startswith("sqlite:///")
                or parsed.netloc
                or parsed.query
                or parsed.fragment
                or not parsed.path[1:]
                or parsed.path.endswith("/")
                or parsed.path[1:] == ":memory:"
            ):
                raise ValueError(
                    "DATABASE_URL의 SQLite 경로는 쿼리 없는 파일 경로여야 합니다."
                )
            path = Path(parsed.path[1:])
            if not path.is_absolute():
                path = BACKEND_ROOT / path
            return SecretStr(f"sqlite:///{path.resolve().as_posix()}")

        raise ValueError(
            "DATABASE_URL은 postgresql://, postgres://, sqlite:///만 지원합니다."
        )
