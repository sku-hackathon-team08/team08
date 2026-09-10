from datetime import datetime
from io import BytesIO
from pathlib import Path
from threading import Lock
from xml.sax.saxutils import escape
from zoneinfo import ZoneInfo

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Flowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

FONT_PATH = Path(__file__).resolve().parents[2] / "assets/fonts/NanumGothic-Regular.ttf"
FONT_LOCK = Lock()
ACTIONS = {
    "REPORT_CLAIMED": "담당 시작",
    "ASSIGNMENT_RELEASED": "담당 해제",
    "CLASSIFICATION_CHANGED": "분류 변경",
    "REPORT_RESOLVED": "완료",
    "REPORT_CANCELLED": "취소",
}
STATUS = {
    "RECEIVED": "접수",
    "IN_PROGRESS": "처리중",
    "RESOLVED": "완료",
    "CANCELLED": "취소",
}
TYPES = {
    "EMERGENCY": "긴급",
    "FACILITY": "시설",
    "CROWD": "혼잡",
    "LOST": "미아/분실",
    "OTHER": "기타",
}


def render_activity_pdf(data: dict) -> bytes:
    admin = "totalActions" in data["summary"]
    report_title = "내 처리 리포트" if admin else "내 활동 리포트"
    period_label = "처리 기간" if admin else "접수 기간"
    with FONT_LOCK:
        if "NanumGothic" not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont("NanumGothic", str(FONT_PATH)))
    output = BytesIO()
    document = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=44,
        leftMargin=44,
        topMargin=46,
        bottomMargin=44,
        title=f"현장의 지금 - {report_title}",
        author="현장의 지금",
    )
    title = ParagraphStyle(
        "title",
        fontName="NanumGothic",
        fontSize=23,
        leading=31,
        textColor=colors.HexColor("#143e47"),
        spaceAfter=18,
        wordWrap="CJK",
    )
    heading = ParagraphStyle(
        "heading",
        fontName="NanumGothic",
        fontSize=12,
        leading=18,
        spaceBefore=14,
        spaceAfter=7,
        wordWrap="CJK",
    )
    body = ParagraphStyle(
        "body",
        fontName="NanumGothic",
        fontSize=10,
        leading=17,
        spaceAfter=8,
        wordWrap="CJK",
    )
    small = ParagraphStyle(
        "small",
        parent=body,
        fontSize=8,
        leading=12,
        textColor=colors.HexColor("#52636a"),
    )

    def p(value, style=body):
        return Paragraph(escape(str(value)).replace("\n", "<br/>"), style)

    def display_time(value):
        return (
            datetime.fromisoformat(value)
            .astimezone(ZoneInfo("Asia/Seoul"))
            .strftime("%Y.%m.%d %H:%M")
            if value
            else "-"
        )

    actor = data["actor"]
    story: list[Flowable] = [
        p("현장의 지금", small),
        p(report_title, title),
        p(f"{actor['name']} · {actor['team'] or '-'}"),
        p(
            f"집계 시간대: {data['range']['timeZone']} | 생성: {display_time(data['asOf'])}",
            small,
        ),
    ]
    if data["range"]["from"]:
        story.append(
            p(
                f"{period_label}: {display_time(data['range']['from'])} 이상 / {display_time(data['range']['to'])} 미만",
                small,
            )
        )
    else:
        story.append(p(f"{period_label}: 전체", small))
    summary = data["summary"]
    average = summary["averageProcessingSeconds"]
    stats = Table(
        [
            [
                p("처리한 신고" if admin else "전체 신고", small),
                p("완료", small),
                p("취소", small),
                p("평균 처리시간", small),
            ],
            [
                p(summary["totalReports"] if admin else summary["total"], heading),
                p(summary["resolved"], heading),
                p(summary["cancelled"], heading),
                p("-" if average is None else f"{average:.1f}초", heading),
            ],
        ],
        colWidths=[125, 125, 125, 132],
    )
    stats.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#eef5f5")),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.extend(
        [
            Spacer(1, 10),
            stats,
            p("현재 유형별 신고" if admin else "유형별 신고", heading),
            p(
                " · ".join(
                    f"{TYPES[row['type']]} {row['count']}건"
                    for row in data["typeDistribution"]
                )
            ),
            p("처리 이력" if admin else "신고 내역", heading),
        ]
    )
    if admin:
        story.insert(4, p("본인이 수행한 처리만 집계 · 단순 지원 참여 제외", small))
        story.append(
            p(
                f"전체 처리 {summary['totalActions']}회 · 담당 시작 {summary['claimed']}회 · "
                f"담당 해제 {summary['released']}회 · 분류 변경 {summary['classificationChanged']}회",
                small,
            )
        )
    if not data["items"]:
        story.append(p("선택한 기간의 신고가 없습니다."))
    for number, item in enumerate(data["items"], 1):
        if admin:
            section = [
                p(
                    f"{number}. {ACTIONS[item['action']]} · {display_time(item['occurredAt'])}",
                    heading,
                ),
                p(item["contentFinal"]),
                p(f"신고 ID: {item['reportId']}", small),
                p(
                    f"현재 상태: {STATUS[item['currentStatus']]} · 현재 유형: {TYPES[item['currentType']]}",
                    small,
                ),
                p(
                    f"접수: {display_time(item['createdAt'])} | 구역: {item['zone']['name'] if item['zone'] else '미지정 구역'}",
                    small,
                ),
            ]
            if item["processingSeconds"] is not None:
                section.append(
                    p(f"최종 배정부터 완료: {item['processingSeconds']:.1f}초", small)
                )
            if item["note"]:
                section.append(p(f"처리 메모: {item['note']}"))
            field_names = {"status": "상태", "type": "유형", "urgency": "위험도"}
            labels = {
                **STATUS,
                **TYPES,
                "URGENT": "긴급",
                "CAUTION": "주의",
                "NORMAL": "보통",
            }
            for change in item["changes"]:
                if change["field"] in field_names:
                    before = labels.get(change["before"], change["before"] or "없음")
                    after = labels.get(change["after"], change["after"] or "없음")
                    section.append(
                        p(f"{field_names[change['field']]}: {before} → {after}", small)
                    )
            short_entry = len(item["contentFinal"]) + len(item["note"] or "") < 1000
            story.extend([KeepTogether(section)] if short_entry else section)
            continue
        section: list[Flowable] = []
        section.append(
            p(
                f"{number}. {STATUS[item['status']]} · {TYPES[item['type']['value']]}",
                heading,
            )
        )
        section.append(p(item["contentFinal"]))
        section.append(
            p(
                f"접수: {display_time(item['createdAt'])} | 구역: {item['zone']['name'] if item['zone'] else '미지정 구역'}",
                small,
            )
        )
        section.append(
            p(
                f"담당 배정: {display_time(item['claimedAt'])} | 완료: {display_time(item['resolvedAt'])}",
                small,
            )
        )

        story.extend(
            [KeepTogether(section)] if len(item["contentFinal"]) < 1000 else section
        )

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("NanumGothic", 8)
        canvas.setFillColor(colors.HexColor("#52636a"))
        canvas.drawString(44, 25, "현장의 지금 · 개인 활동 내역")
        canvas.drawRightString(A4[0] - 44, 25, str(doc.page))
        canvas.restoreState()

    document.build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()
