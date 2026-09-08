from typing import Self

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    """camelCase 입출력과 snake_case 내부 생성을 구분하는 API 스키마."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        validate_by_alias=True,
        validate_by_name=False,
        serialize_by_alias=True,
        loc_by_alias=True,
    )

    @classmethod
    def from_internal(cls, **values: object) -> Self:
        """내부 필드명으로 검증·생성. 잘못된 키는 중첩 입력에서도 거절."""
        return cls.model_validate(values, by_alias=False, by_name=True, extra="forbid")
