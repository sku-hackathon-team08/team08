from io import BytesIO
from uuid import UUID, uuid4

import pytest
from pypdf import PdfReader
from sqlalchemy import update

from app.models.reports import Analysis, Report, ReportLog


async def enter(client, role="ADMIN", code="DEMO26"):
    response = await client.post(
        "/api/v1/sessions",
        json={
            "eventCode": code,
            "role": role,
            "name": "테스트",
            **({"team": "운영"} if role == "STAFF" else {}),
        },
    )
    assert response.status_code == 201, response.text
    data = response.json()
    return (
        {"Authorization": "Bearer " + data["token"]},
        UUID(data["actor"]["id"]),
        UUID(data["event"]["id"]),
    )


async def seed_report(app, actor, event, label):
    async with app.state.database.sessions() as db:
        analysis = Analysis(
            event_id=event,
            actor_id=actor,
            input_method="TEXT",
            status="READY",
            transcript_raw="원문",
            content_suggested="요약",
            type_suggested="OTHER",
            urgency_suggested="NORMAL",
        )
        db.add(analysis)
        await db.flush()
        report = Report(
            event_id=event,
            reporter_id=actor,
            analysis_id=analysis.id,
            content_final=label,
            type_value="OTHER",
            urgency_value="NORMAL",
            type_source="AI_SUGGESTED",
            urgency_source="AI_SUGGESTED",
            position={
                "lat": 37.5,
                "lng": 127,
                "captured_at": "2026-09-01T00:00:00.000Z",
                "accuracy_meters": None,
            },
            position_source="DEMO_FIXED",
            created_at="2026-09-01T00:00:00.000Z",
        )
        db.add(report)
        await db.commit()
        return report.id


@pytest.mark.anyio
async def test_admin_history_reassignment_cancel_progress_and_roles(
    festival, monkeypatch
):
    client, app = festival
    staff, reporter, event = await enter(client, "STAFF")
    first, _, _ = await enter(client)
    second, _, _ = await enter(client)
    helper, _, _ = await enter(client)
    other_event, _, _ = await enter(client, code="OTHER26")
    report = await seed_report(app, reporter, event, "다른 사람이 신고한 내용")
    base = f"/api/v1/admin/reports/{report}"
    claim = {"type": "OTHER", "urgency": "NORMAL"}

    async def change(who, action, version, at, **kwargs):
        monkeypatch.setattr("app.services.reports.now", lambda: at)
        result = await client.patch(
            base + "/" + action,
            headers=who,
            json={"expectedVersion": version, **kwargs},
        )
        assert result.status_code == 200, result.text

    await change(first, "claim", 1, "2026-09-11T00:00:00.000Z", **claim)
    await change(first, "release", 2, "2026-09-11T00:05:00.000Z")
    await change(second, "claim", 3, "2026-09-11T00:10:00.000Z", **claim)
    support = await client.post(
        base + "/support-requests",
        headers={**second, "Idempotency-Key": str(uuid4())},
        json={"expectedVersion": 4},
    )
    assert support.status_code == 201, support.text
    joined = await client.post(
        base
        + f"/support-requests/{support.json()['supportRequest']['id']}/participants",
        headers={**helper, "Idempotency-Key": str(uuid4())},
        json={"expectedVersion": 5},
    )
    assert joined.status_code == 201, joined.text
    await change(
        second, "classification", 6, "2026-09-11T00:12:00.000Z", type="FACILITY"
    )
    await change(
        second,
        "resolve",
        7,
        "2026-09-11T00:20:00.000Z",
        resolveNote="조치 <완료> & 확인",
    )
    # 로그 저장은 완료 시각보다 늦어질 수 있다. 처리시간은 실제 완료 시각으로 계산한다.
    async with app.state.database.sessions() as db:
        await db.execute(
            update(ReportLog)
            .where(ReportLog.report_id == report, ReportLog.action == "REPORT_RESOLVED")
            .values(occurred_at="2026-09-11T00:20:00.500Z")
        )
        await db.commit()
    monkeypatch.setattr(
        "app.services.admin_activity.now", lambda: "2026-09-11T02:00:00.000Z"
    )

    async def history(who):
        response = await client.get(
            "/api/v1/admin/activity-report?period=TODAY", headers=who
        )
        assert response.status_code == 200, response.text
        return response.json()

    a, b = await history(first), await history(second)
    assert {item["action"] for item in a["items"]} == {
        "REPORT_CLAIMED",
        "ASSIGNMENT_RELEASED",
    }
    assert all(item["note"] is None for item in a["items"])
    assert a["summary"]["resolved"] == 0
    assert a["summary"]["averageProcessingSeconds"] is None
    assert b["summary"] == {
        "totalReports": 1,
        "totalActions": 3,
        "claimed": 1,
        "released": 0,
        "classificationChanged": 1,
        "resolved": 1,
        "cancelled": 0,
        "averageProcessingSeconds": 600.0,
    }
    assert b["items"][0]["note"] == "조치 <완료> & 확인"
    assert all(item["reportId"] == str(report) for item in b["items"])
    assert b["typeDistribution"][1] == {"type": "FACILITY", "count": 1}
    assert (await history(helper))["summary"]["totalActions"] == 0
    assert (await history(other_event))["items"] == []
    for suffix in ["", "/export"]:
        forbidden = await client.get(
            "/api/v1/admin/activity-report" + suffix, headers=staff
        )
        assert forbidden.status_code == 403
    mine = await client.get("/api/v1/staff/reports", headers=staff)
    assert len(mine.json()["items"]) == 1
    report = await seed_report(app, reporter, event, "진행 중인 신고")
    base = f"/api/v1/admin/reports/{report}"
    await change(first, "claim", 1, "2026-09-11T01:00:00.000Z", **claim)
    assert (await history(first))["items"][0]["currentStatus"] == "IN_PROGRESS"
    await change(
        second, "cancel", 2, "2026-09-11T01:05:00.000Z", cancelReason="중복 접수"
    )
    assert (await history(second))["summary"]["cancelled"] == 1
    assert (await history(first))["summary"]["cancelled"] == 0
    pdf = await client.get(
        "/api/v1/admin/activity-report/export?period=TODAY", headers=second
    )
    text = "\n".join(p.extract_text() for p in PdfReader(BytesIO(pdf.content)).pages)
    assert "조치 <완료> & 확인" in text and "중복 접수" in text


@pytest.mark.anyio
async def test_admin_full_export_pagination_period_boundaries_empty(
    festival, monkeypatch
):
    client, app = festival
    admin, actor, event = await enter(client)
    _, reporter, _ = await enter(client, "STAFF")
    outsider, _, _ = await enter(client)
    monkeypatch.setattr(
        "app.services.admin_activity.now", lambda: "2026-09-14T01:00:00.000Z"
    )
    times = [
        "2026-09-13T14:59:59.999Z",
        "2026-09-13T15:00:00.000Z",
        "2026-09-14T14:59:59.999Z",
        "2026-09-14T15:00:00.000Z",
        "2026-09-20T15:00:00.000Z",
    ]
    for i in range(25):
        report_id = await seed_report(app, reporter, event, f"기록-{i:02d} 한글 확인")
        async with app.state.database.sessions() as db:
            db.add(
                ReportLog(
                    id=uuid4(),
                    report_id=report_id,
                    actor_id=actor,
                    action="REPORT_CLAIMED",
                    occurred_at=times[i] if i < 5 else "2026-09-14T01:00:00.000Z",
                    changes=[],
                    note=None,
                )
            )
            await db.commit()
    url = "/api/v1/admin/activity-report"
    first = (await client.get(url, headers=admin, params={"period": "ALL"})).json()
    assert first["summary"]["totalActions"] == 25
    assert len(first["items"]) == 20 and first["nextCursor"]
    second = (
        await client.get(
            url, headers=admin, params={"period": "ALL", "cursor": first["nextCursor"]}
        )
    ).json()
    assert len(second["items"]) == 5 and second["nextCursor"] is None
    assert len({item["id"] for item in first["items"] + second["items"]}) == 25
    for who, period in [(outsider, "ALL"), (admin, "TODAY")]:
        response = await client.get(
            url, headers=who, params={"period": period, "cursor": first["nextCursor"]}
        )
        assert response.status_code == 422
    for period, count in [("TODAY", 22), ("WEEK", 23)]:
        response = await client.get(url, headers=admin, params={"period": period})
        assert response.json()["summary"]["totalActions"] == count
        filtered_pdf = await client.get(
            url + "/export", headers=admin, params={"period": period}
        )
        filtered_text = "\n".join(
            p.extract_text() for p in PdfReader(BytesIO(filtered_pdf.content)).pages
        )
        assert "기록-00" not in filtered_text and "기록-04" not in filtered_text
        assert "기록-01" in filtered_text and "기록-02" in filtered_text
        assert ("기록-03" in filtered_text) == (period == "WEEK")
    exported = await client.get(url + "/export?period=ALL", headers=admin)
    assert exported.status_code == 200
    assert exported.headers["content-type"] == "application/pdf"
    assert exported.headers["cache-control"] == "no-store"
    reader = PdfReader(BytesIO(exported.content))
    text = "\n".join(page.extract_text() for page in reader.pages)
    assert len(reader.pages) > 1
    assert "내 처리 리포트" in text and "처리 기간: 전체" in text
    for i in range(25):
        assert f"기록-{i:02d}" in text
    empty = (await client.get(url, headers=outsider)).json()
    assert empty["items"] == [] and empty["summary"]["averageProcessingSeconds"] is None
    empty_pdf = await client.get(url + "/export", headers=outsider)
    assert empty_pdf.status_code == 200
    assert (
        "선택한 기간의 신고가 없습니다"
        in PdfReader(BytesIO(empty_pdf.content)).pages[0].extract_text()
    )
    paths = (await client.get("/openapi.json")).json()["paths"]
    assert paths[url]["get"]["responses"]["200"]["content"]["application/json"][
        "schema"
    ]["$ref"].endswith("AdminActivityReport")
    assert paths["/api/v1/staff/activity-report"]["get"]["deprecated"] is True
