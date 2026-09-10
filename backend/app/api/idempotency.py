import json
from decimal import Decimal
from uuid import UUID

from fastapi import Request
from fastapi.exceptions import RequestValidationError


def idempotency_key(request: Request) -> UUID:
    values = request.headers.getlist("idempotency-key")
    try:
        if len(values) != 1:
            raise ValueError()
        key = UUID(values[0])
        if key.version != 4 or str(key) != values[0]:
            raise ValueError()
        return key
    except ValueError:
        kind = (
            "missing"
            if not values
            else "duplicate_field"
            if len(values) > 1
            else "value_error"
        )
        raise RequestValidationError(
            [
                {
                    "type": kind,
                    "loc": ("header", "idempotency-key"),
                    "msg": "UUIDv4 키가 필요합니다.",
                }
            ]
        ) from None


async def json_fingerprint_input(request: Request):
    return json.loads(await request.body(), parse_float=Decimal)
