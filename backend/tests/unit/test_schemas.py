import json

import pytest
from pydantic import ConfigDict, ValidationError

from app.schemas.base import ApiModel


class Item(ApiModel):
    # 미등록 키를 무시하는 실험 모델. 실제 요청 모델의 정책은 별도 결정.
    model_config = ConfigDict(extra="ignore")

    item_id: int
    note_text: str | None = None


class ItemList(ApiModel):
    model_config = ConfigDict(extra="ignore")

    item_list: list[Item]
    metadata: dict[str, object]


def test_internal_creation_accepts_snake_case_keywords_and_nested_data() -> None:
    result = ItemList.from_internal(
        item_list=[{"item_id": 1, "note_text": "메모"}],
        metadata={"custom_key": {"nested_key": "unchanged_value"}},
    )

    assert result.item_list[0].item_id == 1
    assert result.item_list[0].note_text == "메모"
    assert result.metadata == {"custom_key": {"nested_key": "unchanged_value"}}


def test_internal_creation_accepts_validated_nested_models() -> None:
    item = Item.from_internal(item_id=1)
    result = ItemList.from_internal(item_list=[item], metadata={})

    assert result.item_list == [item]
    assert result.item_list[0].note_text is None
    assert result.item_list[0].model_fields_set == {"item_id"}


@pytest.mark.parametrize(
    "values",
    [
        {"item_list": [{"item_id": "invalid"}], "metadata": {}},
        {"item_list": [{"item_id": 1, "note_text": []}], "metadata": {}},
        {"item_list": [{}], "metadata": {}},
    ],
)
def test_internal_creation_validates_values(values: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        ItemList.from_internal(**values)


@pytest.mark.parametrize("key", ["noteText", "note_txt"])
def test_internal_creation_rejects_aliases_and_misspelled_keys(key: str) -> None:
    with pytest.raises(ValidationError) as caught:
        Item.from_internal(item_id=1, **{key: "ignored by the HTTP test model"})

    assert any(error["type"] == "extra_forbidden" for error in caught.value.errors())


def test_internal_creation_rejects_unknown_nested_keys() -> None:
    with pytest.raises(ValidationError) as caught:
        ItemList.from_internal(
            item_list=[{"item_id": 1, "note_txt": "typo"}], metadata={}
        )

    assert any(error["type"] == "extra_forbidden" for error in caught.value.errors())


def test_internal_options_do_not_change_default_external_validation() -> None:
    Item.from_internal(item_id=1, note_text="internal")

    with pytest.raises(ValidationError):
        Item.model_validate({"item_id": 1})
    result = Item.model_validate({"itemId": 2, "note_text": "ignored"})

    assert result.item_id == 2
    assert result.note_text is None
    assert result.model_fields_set == {"item_id"}


def test_serialization_uses_aliases_and_preserves_arbitrary_dictionary_keys() -> None:
    result = ItemList.from_internal(
        item_list=[{"item_id": 1}],
        metadata={"custom_key": {"nested_key": "unchanged_value"}},
    )
    expected = {
        "itemList": [{"itemId": 1, "noteText": None}],
        "metadata": {"custom_key": {"nested_key": "unchanged_value"}},
    }

    assert result.model_dump() == expected
    assert json.loads(result.model_dump_json()) == expected
    assert result.model_dump(by_alias=False)["item_list"] == [
        {"item_id": 1, "note_text": None}
    ]
