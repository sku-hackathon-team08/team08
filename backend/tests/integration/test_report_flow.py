import asyncio
from uuid import uuid4

import pytest


async def login(client, role="STAFF", code="DEMO26"):
    body = {"eventCode": code, "role": role, "name": "사용자"}
    if role == "STAFF":
        body["team"] = "운영"
    response = await client.post("/api/v1/sessions", json=body)
    assert response.status_code == 201, response.text
    return {"Authorization": "Bearer " + response.json()["token"]}


async def analysis(client, headers):
    key = str(uuid4())
    body = {"inputMethod": "TEXT", "text": "출입구에 사람이 몰려 있습니다."}
    first = await client.post(
        "/api/v1/report-analyses",
        headers={**headers, "Idempotency-Key": key},
        json=body,
    )
    assert first.status_code == 202, first.text
    again = await client.post(
        "/api/v1/report-analyses",
        headers={**headers, "Idempotency-Key": key},
        json=body,
    )
    assert again.json() == first.json()
    ready = await client.get(first.headers["location"], headers=headers)
    assert ready.json()["status"] == "READY", ready.text
    return first.json()["id"]


async def intake(client, headers):
    aid = await analysis(client, headers)
    data = {
        "analysisId": aid,
        "contentFinal": "확인한 혼잡 신고",
        "type": "CROWD",
        "urgency": "CAUTION",
        "position": {
            "lat": 0,
            "lng": 0,
            "capturedAt": "2026-09-11T10:00:00+09:00",
            "accuracyMeters": 10,
        },
    }
    key = str(uuid4())
    first = await client.post(
        "/api/v1/staff/reports", headers={**headers, "Idempotency-Key": key}, json=data
    )
    assert first.status_code == 201, first.text
    again = await client.post(
        "/api/v1/staff/reports", headers={**headers, "Idempotency-Key": key}, json=data
    )
    assert again.json() == first.json()
    used = await client.post(
        "/api/v1/staff/reports",
        headers={**headers, "Idempotency-Key": str(uuid4())},
        json=data,
    )
    assert used.status_code == 409 and used.json()["code"] == "ANALYSIS_ALREADY_USED"
    assert first.json()["position"]["lat"] == 37.5683536
    assert first.json()["position"]["accuracyMeters"] is None
    return first.json()["id"]


@pytest.mark.anyio
async def test_intake_isolation_claim_race_support_and_resolution(festival):
    client, app = festival
    staff = await login(client)
    other_staff = await login(client)
    admin = await login(client, "ADMIN")
    other_admin = await login(client, "ADMIN")
    stranger = await login(client, "ADMIN", "OTHER26")
    report_id = await intake(client, staff)
    base = f"/api/v1/admin/reports/{report_id}"
    assert (
        await client.get(f"/api/v1/staff/reports/{report_id}", headers=other_staff)
    ).status_code == 404
    assert (await client.get(base, headers=stranger)).status_code == 404
    assert (await client.get(base, headers=staff)).status_code == 403
    assert (await client.get("/api/v1/admin/reports", headers=admin)).json()["items"][
        0
    ]["id"] == report_id
    assert (await client.get(base, headers=admin)).json()["status"] == "RECEIVED"
    claims = await asyncio.gather(
        *[
            client.patch(
                base + "/claim",
                headers=h,
                json={"expectedVersion": 1, "type": "CROWD", "urgency": urgency},
            )
            for h, urgency in [(admin, "URGENT"), (other_admin, "NORMAL")]
        ]
    )
    assert sorted(response.status_code for response in claims) == [200, 409], [
        r.text for r in claims
    ]
    winner, helper = (
        (admin, other_admin) if claims[0].status_code == 200 else (other_admin, admin)
    )
    current = (await client.get(base, headers=admin)).json()
    assert current["version"] == 2 and current["status"] == "IN_PROGRESS"
    assert (
        await client.patch(
            base + "/resolve", headers=helper, json={"expectedVersion": 2}
        )
    ).status_code == 403
    support = (
        await client.post(
            base + "/support-requests",
            headers={**winner, "Idempotency-Key": str(uuid4())},
            json={"expectedVersion": 2},
        )
    ).json()
    sid = support["supportRequest"]["id"]
    support_base = base + "/support-requests/" + sid
    joined = await client.post(
        support_base + "/participants",
        headers={**helper, "Idempotency-Key": str(uuid4())},
        json={"expectedVersion": 3},
    )
    assert joined.status_code == 201, joined.text
    pid = joined.json()["participation"]["id"]
    left = await client.patch(
        support_base + "/participants/" + pid + "/cancel",
        headers=helper,
        json={"expectedVersion": 4},
    )
    assert left.status_code == 200, left.text
    rejoined = await client.post(
        support_base + "/participants",
        headers={**helper, "Idempotency-Key": str(uuid4())},
        json={"expectedVersion": 5},
    )
    assert rejoined.status_code == 201, rejoined.text
    assert rejoined.json()["participation"]["id"] != pid
    delayed = await client.patch(
        support_base + "/participants/" + pid + "/cancel",
        headers=helper,
        json={"expectedVersion": 6},
    )
    assert delayed.status_code == 409
    resolved = await client.patch(
        base + "/resolve", headers=winner, json={"expectedVersion": 6}
    )
    assert resolved.status_code == 200, resolved.text
    assert resolved.json()["version"] == 7
    assert resolved.json()["supportRequestId"] is None
    assert resolved.json()["activeSupporterCount"] == 0
    assert resolved.json()["resolveNote"] is None
    participants = (
        await client.get(support_base + "/participants", headers=admin)
    ).json()["items"]
    assert all(p["endedAt"] is not None for p in participants)
    assert participants[-1]["endReason"] == "REQUEST_CLOSED"
    logs = (await client.get(base + "/logs", headers=admin)).json()["items"]
    assert sum(log["action"] == "REPORT_CLAIMED" for log in logs) == 1
    assert any(log["action"] == "SUPPORT_REQUEST_CLOSED" for log in logs)
    assert app.state.analysis_provider.calls == 1


@pytest.mark.anyio
async def test_failed_analysis_never_intakes_and_secret_is_hidden(festival):
    client, app = festival
    staff = await login(client)
    app.state.analysis_provider.fail = True
    created = await client.post(
        "/api/v1/report-analyses",
        headers={**staff, "Idempotency-Key": str(uuid4())},
        json={"inputMethod": "TEXT", "text": "원본"},
    )
    assert created.status_code == 202
    result = await client.get(created.headers["location"], headers=staff)
    assert result.json()["status"] == "FAILED"
    assert result.json()["transcriptRaw"] is None
    assert "private-provider-error" not in result.text
    assert (await client.get("/api/v1/staff/reports", headers=staff)).json()[
        "items"
    ] == []


@pytest.mark.anyio
async def test_cancel_keeps_staff_history_and_hides_admin_list(festival):
    client, _ = festival
    staff = await login(client)
    admin = await login(client, "ADMIN")
    report_id = await intake(client, staff)
    base = f"/api/v1/admin/reports/{report_id}"
    bad = await client.patch(
        base + "/cancel",
        headers=admin,
        json={"expectedVersion": 1, "cancelReason": " "},
    )
    assert bad.status_code == 422
    cancelled = await client.patch(
        base + "/cancel",
        headers=admin,
        json={"expectedVersion": 1, "cancelReason": "중복 확인"},
    )
    assert cancelled.status_code == 200, cancelled.text
    assert (await client.get("/api/v1/admin/reports", headers=admin)).json()[
        "items"
    ] == []
    assert (await client.get("/api/v1/admin/map-reports", headers=admin)).json()[
        "items"
    ] == []
    assert (
        await client.get(f"/api/v1/staff/reports/{report_id}", headers=staff)
    ).json()["status"] == "CANCELLED"
    assert (await client.get(base, headers=admin)).json()["cancelReason"] == "중복 확인"


@pytest.mark.anyio
async def test_voice_limits_multipart_duplicates_and_analysis_owner(festival):
    client, app = festival
    staff = await login(client)
    admin = await login(client, "ADMIN")
    headers = {**staff, "Idempotency-Key": str(uuid4())}
    voice = await client.post(
        "/api/v1/report-analyses",
        headers=headers,
        data={"inputMethod": "VOICE"},
        files={"audio": ("test.wav", b"fake-provider-fixture", "audio/wav")},
    )
    assert voice.status_code == 202, voice.text
    replay = await client.post(
        "/api/v1/report-analyses",
        headers=headers,
        data={"inputMethod": "VOICE"},
        files={"audio": ("renamed.wav", b"fake-provider-fixture", "audio/wav")},
    )
    assert replay.json() == voice.json()
    assert app.state.analysis_provider.calls == 1
    assert (
        await client.get(voice.headers["location"], headers=admin)
    ).status_code == 404
    forbidden = await client.post(
        "/api/v1/report-analyses",
        headers={**admin, "Idempotency-Key": str(uuid4())},
        data={"inputMethod": "VOICE"},
        files={"audio": ("test.wav", b"audio", "audio/wav")},
    )
    assert forbidden.status_code == 403
    bad = await client.post(
        "/api/v1/report-analyses",
        headers={**staff, "Idempotency-Key": str(uuid4())},
        json={"inputMethod": "TEXT", "text": "a" * 5001},
    )
    assert bad.status_code == 422
    unknown = await client.get("/api/v1/staff/reports?actorId=forged", headers=staff)
    assert (
        unknown.status_code == 422
        and unknown.json()["errors"][0]["code"] == "UNKNOWN_FIELD"
    )
    duplicate = await client.post(
        "/api/v1/report-analyses",
        headers={
            **staff,
            "Idempotency-Key": str(uuid4()),
            "Content-Type": "application/json",
        },
        content='{"inputMethod":"TEXT","text":"a","text":"b"}',
    )
    assert (
        duplicate.status_code == 422
        and duplicate.json()["errors"][0]["code"] == "DUPLICATE_FIELD"
    )


@pytest.mark.anyio
async def test_release_preserves_first_timestamp_and_closes_support(festival):
    from datetime import UTC, datetime, timedelta
    from uuid import UUID

    from app.models.reports import Report

    client, app = festival
    staff = await login(client)
    admin = await login(client, "ADMIN")
    helper = await login(client, "ADMIN")
    report_id = await intake(client, staff)
    base = f"/api/v1/admin/reports/{report_id}"
    old = (
        (datetime.now(UTC) - timedelta(minutes=5))
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )
    async with app.state.database.sessions() as db:
        row = await db.get(Report, UUID(report_id))
        row.created_at = old
        await db.commit()
    claimed = await client.patch(
        base + "/claim",
        headers=admin,
        json={"expectedVersion": 1, "type": "CROWD", "urgency": "URGENT"},
    )
    assert claimed.status_code == 200
    opened = await client.post(
        base + "/support-requests",
        headers={**admin, "Idempotency-Key": str(uuid4())},
        json={"expectedVersion": 2},
    )
    sid = opened.json()["supportRequest"]["id"]
    joined = await client.post(
        base + "/support-requests/" + sid + "/participants",
        headers={**helper, "Idempotency-Key": str(uuid4())},
        json={"expectedVersion": 3},
    )
    assert joined.status_code == 201
    released = await client.patch(
        base + "/release", headers=admin, json={"expectedVersion": 4}
    )
    assert released.status_code == 200, released.text
    value = released.json()
    assert value["createdAt"] == old and value["isUnacknowledged"]
    assert value["claimedBy"] is None and value["claimedAt"] is None
    assert value["supportRequestId"] is None and value["activeSupporterCount"] == 0
    assert value["zone"] is None


@pytest.mark.anyio
async def test_admin_intake_uses_selected_location_and_suggested_urgency(festival):
    client, _ = festival
    admin = await login(client, "ADMIN")
    aid = await analysis(client, admin)
    data = {
        "analysisId": aid,
        "contentFinal": "관리자 확인",
        "type": "FACILITY",
        "position": {
            "lat": 37.57,
            "lng": 126.9,
            "capturedAt": "2026-09-11T01:00:00.000Z",
            "accuracyMeters": None,
        },
    }
    response = await client.post(
        "/api/v1/admin/reports",
        headers={**admin, "Idempotency-Key": str(uuid4())},
        json=data,
    )
    assert response.status_code == 201, response.text
    assert response.json()["position"]["lat"] == 37.57
    assert response.json()["positionSource"] == "MAP_SELECTED"
    assert response.json()["urgency"]["value"] == "CAUTION"
    assert response.json()["type"]["source"] == "ADMIN_SELECTED"
    assert response.json()["claimedBy"] is None and response.json()["zone"] is None
    stats = (await client.get("/api/v1/admin/stats", headers=admin)).json()
    assert stats["total"] == 1
    cancelled = await client.patch(
        "/api/v1/admin/reports/" + response.json()["id"] + "/cancel",
        headers=admin,
        json={"expectedVersion": 1, "cancelReason": "취소 테스트"},
    )
    assert cancelled.status_code == 200
    assert (await client.get("/api/v1/admin/stats", headers=admin)).json()["total"] == 1
    assert (await client.get("/api/v1/admin/reports", headers=admin)).json()[
        "items"
    ] == []


@pytest.mark.anyio
async def test_cors_and_multipart_duplicate_contract(festival):
    client, _ = festival
    preflight = await client.options(
        "/api/v1/report-analyses",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,idempotency-key,content-type",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == "http://localhost:5173"
    staff = await login(client)
    duplicate = await client.post(
        "/api/v1/report-analyses",
        headers={**staff, "Idempotency-Key": str(uuid4())},
        files=[
            ("inputMethod", (None, "VOICE")),
            ("audio", ("one.wav", b"a", "audio/wav")),
            ("audio", ("two.wav", b"b", "audio/wav")),
        ],
    )
    assert duplicate.status_code == 422
    assert any(
        error["code"] == "DUPLICATE_FIELD" for error in duplicate.json()["errors"]
    )


@pytest.mark.anyio
@pytest.mark.parametrize("method", ["TEXT", "VOICE"])
async def test_analysis_waits_do_not_hold_database_connections(
    festival, monkeypatch, method
):
    from sqlalchemy import select

    from app.models.reports import Analysis

    client, app = festival
    headers = await login(client)
    provider = app.state.analysis_provider
    started = asyncio.Queue()
    release = asyncio.Event()
    original = provider.transcribe if method == "VOICE" else provider.analyze

    async def blocked(*args):
        await started.put(True)
        await release.wait()
        return await original(*args)

    monkeypatch.setattr(
        provider, "transcribe" if method == "VOICE" else "analyze", blocked
    )
    requests = []
    try:
        for _ in range(5):
            payload = (
                {"json": {"inputMethod": "TEXT", "text": "혼잡 신고"}}
                if method == "TEXT"
                else {
                    "data": {"inputMethod": "VOICE"},
                    "files": {"audio": ("test.webm", b"voice", "audio/webm")},
                }
            )
            requests.append(
                asyncio.create_task(
                    client.post(
                        "/api/v1/report-analyses",
                        headers={**headers, "Idempotency-Key": str(uuid4())},
                        **payload,
                    )
                )
            )
            await asyncio.wait_for(started.get(), timeout=5)
        assert app.state.database.engine.pool.checkedout() == 0
        async with asyncio.timeout(5):
            assert (
                await client.get("/api/v1/sessions/me", headers=headers)
            ).status_code == 200
            async with app.state.database.sessions() as db:
                rows = list((await db.scalars(select(Analysis))).all())
                assert len(rows) == 5
                assert all(row.status == "PROCESSING" for row in rows)
    finally:
        release.set()
        responses = await asyncio.gather(*requests)
    for response in responses:
        assert response.status_code == 202
        ready = await client.get(response.headers["location"], headers=headers)
        assert ready.json()["status"] == "READY"
