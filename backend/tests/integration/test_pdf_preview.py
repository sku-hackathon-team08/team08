from datetime import date
from io import BytesIO

import pytest
from pypdf import PdfReader
from sqlalchemy import func, select

from app.models.reports import Report, ReportLog
from app.services.activity_pdf import render_activity_pdf
from app.services.admin_activity import admin_activity_data
from scripts.preview_activity_pdf import seed_preview


@pytest.mark.anyio
async def test_preview_seed_preserves_existing_rows_on_repeat(festival):
    _, app = festival
    async with app.state.database.sessions() as db:
        identity = await seed_preview(db, date(2026, 9, 12))
        data = await admin_activity_data(db, identity, "ALL")
        assert data["summary"]["totalReports"] == 18
        assert data["summary"]["totalActions"] == 36
        assert data["summary"]["resolved"] == 12
        assert data["summary"]["cancelled"] == 2
        assert data["summary"]["released"] == 2
        assert data["summary"]["classificationChanged"] == 2
        report = await db.scalar(
            select(Report).where(Report.event_id == identity.event.id)
        )
        assert report is not None
        report.content_final = "목 데이터 수동 수정 보존"
        await db.commit()
    async with app.state.database.sessions() as db:
        again = await seed_preview(db, date(2026, 10, 1))
        assert identity.actor.id == again.actor.id
        assert await db.scalar(select(func.count()).select_from(Report)) == 18
        assert await db.scalar(select(func.count()).select_from(ReportLog)) == 36
        data = await admin_activity_data(db, again, "ALL")
    reader = PdfReader(BytesIO(render_activity_pdf(data)))
    text = "\n".join(page.extract_text() for page in reader.pages)
    assert "목 데이터 수동 수정 보존" in text
    assert "처리 타임라인" in text and "날짜별 처리 활동" in text
    assert all(
        label in text
        for label in ["담당 시작", "담당 해제", "분류 변경", "완료", "취소"]
    )
