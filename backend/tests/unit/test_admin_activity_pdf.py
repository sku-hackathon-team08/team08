from datetime import UTC, datetime, timedelta
from io import BytesIO

from pypdf import PdfReader

from app.services.activity_pdf import render_activity_pdf
from app.services.admin_activity_pdf import activity_bins, duration_label


def test_activity_bins_include_kst_midnight_gaps_and_entire_long_period():
    items = [
        {"occurredAt": value}
        for value in [
            "2026-09-10T14:59:00Z",
            "2026-09-10T15:00:00Z",
            "2026-09-12T15:00:00Z",
        ]
    ]
    assert activity_bins(items) == [
        ("09.10", 1),
        ("09.11", 1),
        ("09.12", 0),
        ("09.13", 1),
    ]
    items = [
        {
            "occurredAt": (
                datetime(2025, 1, 1, tzinfo=UTC) + timedelta(days=i)
            ).isoformat()
        }
        for i in range(400)
    ]
    bins = activity_bins(items)
    assert len(bins) <= 7
    assert sum(count for _, count in bins) == 400
    assert activity_bins([]) == []


def test_duration_keeps_subminute_results_and_missing_values_distinct():
    assert duration_label(None) == "집계 없음"
    assert duration_label(0) == "0초"
    assert duration_label(25) == "25초"
    assert duration_label(90) == "1분 30초"
    assert duration_label(59.9) == "1분"


def test_long_timeline_preserves_every_line_across_pages(tmp_path):
    content = "\n".join(f"신고본문-{i:03d} 현장 확인 <내용> & 안내" for i in range(90))
    note = "\n".join(
        f"처리메모-{i:03d} 담당자가 현장에서 확인한 기록" for i in range(90)
    )
    data = {
        "actor": {"name": "가상 관리자", "team": "운영"},
        "asOf": "2026-09-12T03:00:00Z",
        "range": {"from": None, "to": None, "timeZone": "Asia/Seoul"},
        "summary": {
            "totalReports": 1,
            "totalActions": 1,
            "resolved": 1,
            "cancelled": 0,
            "averageProcessingSeconds": 25,
        },
        "typeDistribution": [{"type": "OTHER", "count": 1}],
        "items": [
            {
                "id": "1",
                "reportId": "1",
                "action": "REPORT_RESOLVED",
                "occurredAt": "2026-09-12T01:00:00Z",
                "currentType": "OTHER",
                "currentStatus": "RESOLVED",
                "contentFinal": content,
                "note": note,
                "zone": None,
                "processingSeconds": 25,
                "changes": [
                    {"field": "status", "before": "IN_PROGRESS", "after": "RESOLVED"}
                ],
            }
        ],
    }
    pdf = render_activity_pdf(data)
    (tmp_path / "long-timeline.pdf").write_bytes(pdf)
    reader = PdfReader(BytesIO(pdf))
    text = "\n".join(page.extract_text() for page in reader.pages)
    assert len(reader.pages) > 3
    assert "신고본문-000" in reader.pages[1].extract_text()
    assert "25초" in text and "<내용> & 안내" in text
    for i in range(90):
        assert text.count(f"신고본문-{i:03d}") == 1
        assert text.count(f"처리메모-{i:03d}") == 1
    assert "변경 · 상태: 처리중 → 완료" in text
