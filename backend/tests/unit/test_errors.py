import pytest
from pydantic import ValidationError

from app.schemas.errors import ErrorResponse


def test_general_error_serializes_all_required_fields_and_empty_errors() -> None:
    error = ErrorResponse.from_internal(
        status=400, code="BAD_REQUEST", detail="요청을 확인해주세요.", errors=()
    )

    assert error.model_dump(mode="json") == {
        "status": 400,
        "code": "BAD_REQUEST",
        "detail": "요청을 확인해주세요.",
        "errors": [],
    }


@pytest.mark.parametrize(
    "errors", [None, [{"field": "name", "detail": "미정 계약"}], ["invalid"]]
)
def test_general_error_does_not_accept_field_error_items(errors: object) -> None:
    with pytest.raises(ValidationError):
        ErrorResponse.from_internal(
            status=400, code="BAD_REQUEST", detail="오류", errors=errors
        )


def test_general_error_requires_errors_even_when_empty() -> None:
    with pytest.raises(ValidationError):
        ErrorResponse.from_internal(status=400, code="BAD_REQUEST", detail="오류")


def test_general_error_schema_models_an_empty_array_without_field_item_contract() -> (
    None
):
    schema = ErrorResponse.model_json_schema(mode="serialization")

    assert set(schema["required"]) == {"status", "code", "detail", "errors"}
    errors = schema["properties"]["errors"]
    assert errors["type"] == "array"
    assert errors["minItems"] == errors["maxItems"] == 0
