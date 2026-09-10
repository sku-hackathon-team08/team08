from datetime import UTC, datetime
from io import BytesIO
from uuid import UUID, uuid4

import pytest
from pypdf import PdfReader

from app.models.reports import Analysis, Report
from app.services.activity import period_range
from app.services.reports import now


@pytest.mark.anyio
async def test_full_period_summary_pagination_pdf_and_isolation(festival):
    client, app = festival
    entered = (
        await client.post(
            "/api/v1/sessions",
            json={
                "eventCode": "DEMO26",
                "role": "STAFF",
                "name": "테스트 스태프",
                "team": "운영팀",
            },
        )
    ).json()
    headers = {"Authorization": "Bearer " + entered["token"]}
    aid, eid = UUID(entered["actor"]["id"]), UUID(entered["event"]["id"])
    async with app.state.database.sessions() as db:
        for i in range(23):
            analysis_id = uuid4()
            db.add(
                Analysis(
                    id=analysis_id,
                    event_id=eid,
                    actor_id=aid,
                    input_method="TEXT",
                    status="READY",
                    transcript_raw="원문",
                    content_suggested="요약",
                    type_suggested="OTHER",
                    urgency_suggested="NORMAL",
                )
            )
            await db.flush()
            row = Report(
                event_id=eid,
                reporter_id=aid,
                analysis_id=analysis_id,
                content_final=f"기록-{i:02d} 안내 표지판 확인",
                type_value="OTHER",
                urgency_value="NORMAL",
                type_source="AI_SUGGESTED",
                urgency_source="AI_SUGGESTED",
                position={
                    "lat": 37.5683536,
                    "lng": 126.8970733,
                    "captured_at": now(),
                    "accuracy_meters": None,
                },
                position_source="DEMO_FIXED",
                zone=None,
                created_at=now(),
            )
            if i == 0:
                row.status = "RESOLVED"
                row.claimed_at = "2026-09-11T01:05:00.000Z"
                row.resolved_at = "2026-09-11T01:15:00.000Z"
            elif i == 1:
                row.status = "CANCELLED"
                row.cancelled_at = now()
            db.add(row)
        await db.commit()
    first = await client.get(
        "/api/v1/staff/activity-report?period=ALL", headers=headers
    )
    assert first.status_code == 200, first.text
    body = first.json()
    assert body["summary"] == {
        "total": 23,
        "resolved": 1,
        "cancelled": 1,
        "averageProcessingSeconds": 600.0,
    }
    assert len(body["items"]) == 20 and body["nextCursor"]
    second = await client.get(
        "/api/v1/staff/activity-report",
        params={"period": "ALL", "cursor": body["nextCursor"]},
        headers=headers,
    )
    assert len(second.json()["items"]) == 3 and second.json()["nextCursor"] is None
    wrong = await client.get(
        "/api/v1/staff/activity-report",
        params={"period": "TODAY", "cursor": body["nextCursor"]},
        headers=headers,
    )
    assert wrong.status_code == 422
    exported = await client.get(
        "/api/v1/staff/activity-report/export?period=ALL", headers=headers
    )
    assert exported.status_code == 200, (
        exported.text[:200] if exported.status_code != 200 else ""
    )
    assert exported.headers["content-type"] == "application/pdf"
    assert exported.headers["cache-control"] == "no-store"
    reader = PdfReader(BytesIO(exported.content))
    text = "\n".join(page.extract_text() for page in reader.pages)
    assert len(reader.pages) >= 2
    for i in range(23):
        assert f"기록-{i:02d}" in text
    outsider = (
        await client.post(
            "/api/v1/sessions",
            json={
                "eventCode": "DEMO26",
                "role": "STAFF",
                "name": "다른 사람",
                "team": "운영팀",
            },
        )
    ).json()
    empty = await client.get(
        "/api/v1/staff/activity-report?period=ALL",
        headers={"Authorization": "Bearer " + outsider["token"]},
    )
    assert empty.json()["summary"]["total"] == 0
    assert empty.json()["summary"]["averageProcessingSeconds"] is None


def test_korean_day_week_boundaries():
    assert period_range("TODAY", "2026-09-10T15:00:00.000Z") == (
        "2026-09-10T15:00:00.000Z",
        "2026-09-11T15:00:00.000Z",
    )
    assert period_range("WEEK", "2026-09-13T15:00:00.000Z") == (
        "2026-09-13T15:00:00.000Z",
        "2026-09-20T15:00:00.000Z",
    )
    assert period_range("ALL", datetime.now(UTC).isoformat()) == (None, None)
