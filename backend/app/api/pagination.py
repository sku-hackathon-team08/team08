import base64
import hashlib
import hmac
import json
from typing import Annotated

from fastapi import Query, Request
from fastapi.exceptions import RequestValidationError

PageSize = Annotated[int, Query(alias="pageSize", ge=1, le=100)]


def page(
    request: Request,
    items: list,
    cursor: str | None,
    page_size: int,
    scope: str,
    as_of: str,
) -> dict:
    filters = sorted(
        (k, v) for k, v in request.query_params.multi_items() if k != "cursor"
    )
    signature = hashlib.sha256(
        json.dumps([scope, request.url.path, filters]).encode()
    ).hexdigest()
    secret = request.app.state.cursor_secret
    offset = 0
    if cursor is not None:
        try:
            payload, mac = cursor.split(".")
            expected = hmac.new(secret, payload.encode(), hashlib.sha256).hexdigest()
            if not hmac.compare_digest(mac, expected):
                raise ValueError()
            saved = json.loads(base64.urlsafe_b64decode(payload))
            if (
                saved["scope"] != signature
                or type(saved["offset"]) is not int
                or saved["offset"] < 0
            ):
                raise ValueError()
            offset = saved["offset"]
        except (ValueError, KeyError, TypeError):
            raise RequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("query", "cursor"),
                        "msg": "커서를 확인해주세요.",
                    }
                ]
            ) from None
    next_cursor = None
    if offset + page_size < len(items):
        payload = base64.urlsafe_b64encode(
            json.dumps({"scope": signature, "offset": offset + page_size}).encode()
        ).decode()
        next_cursor = (
            payload
            + "."
            + hmac.new(secret, payload.encode(), hashlib.sha256).hexdigest()
        )
    return {
        "items": items[offset : offset + page_size],
        "nextCursor": next_cursor,
        "asOf": as_of,
    }
