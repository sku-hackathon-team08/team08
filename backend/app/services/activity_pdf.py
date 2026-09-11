from datetime import datetime
from io import BytesIO
from pathlib import Path
from threading import Lock
from typing import Any
from xml.sax.saxutils import escape
from zoneinfo import ZoneInfo

from reportlab.graphics.shapes import Circle, Drawing
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

# ── ONCUE 색 토큰 — frontend/src/styles/tokens.css(@theme)에서 그대로 옮겼다. ink-*·
# status-cancel처럼 반투명(rgba) 토큰은 reportlab Paragraph/Table이 알파를 안정적으로
# 못 섞어서, 흰 배경 위에 미리 섞은 solid hex로 근사한다(계산식은 각 상수 옆 주석 참고).
PRIMARY = "#3366FF"
PRIMARY_DEEP = "#2347E0"
PRIMARY_ULTRA = "#1D3AC4"
PRIMARY_LIGHT = "#8AA6FF"
PRIMARY_SUB = "#A8C1FF"
PRIMARY_TINT = "#EEF2FF"  # bg-primary/6 근사 — 통계 카드·평균 처리시간 배경
CARD_BG_SOFT = "#F5F7FF"  # bg-primary/3 근사 — 처리 이력 카드 배경

INK_900 = "#171717"
INK_600 = "#858688"  # rgba(55,56,60,.61) on white
INK_500 = "#9A9B9E"  # rgba(55,56,60,.5) on white
INK_400 = "#AFAFB1"  # rgba(55,56,60,.4) on white
INK_300 = "#C7C7C8"  # rgba(55,56,60,.28) on white — status-cancel과 동일 근사
LINE = "#E8E9EA"  # rgba(112,115,124,.16) on white
SURFACE_CHIP = "#F4F4F5"

STATUS_TINT = {  # 상태 배지 배경 — 상태색 12% on white 근사
    "RECEIVED": "#FFE8E8",
    "IN_PROGRESS": "#E7EDFF",
    "RESOLVED": "#E0F7E8",
    # 취소 카드 배경이 이미 SURFACE_CHIP이라 배지도 같은 색이면 안 보임 — 흰색으로 대비.
    "CANCELLED": "#FFFFFF",
}
STATUS_TEXT = {
    "RECEIVED": "#FF4242",
    "IN_PROGRESS": PRIMARY,
    "RESOLVED": "#00BF40",
    "CANCELLED": INK_500,
}
STATUS_ACCENT = {  # 이력 카드 왼쪽 강조선
    "RECEIVED": "#FF4242",
    "IN_PROGRESS": PRIMARY,
    "RESOLVED": "#00BF40",
    "CANCELLED": INK_300,
}
TYPE_INK = {  # 유형 분포 라벨·막대 색
    "EMERGENCY": "#E01B1B",
    "FACILITY": "#D97400",
    "CROWD": "#C52470",
    "LOST": "#00963A",
    "OTHER": "#737477",
}

CONTENT_WIDTH = A4[0] - 44 - 44


def _brand_mark(diameter: float = 13) -> Drawing:
    """ONCUE 마크 — components/BrandLogo.tsx와 같은 비율(큰 원:작은 원 22:17)."""
    small = diameter * (17 / 22)
    width = diameter * (34 / 22)
    height = diameter * (26 / 22)
    d = Drawing(width, height)
    d.add(
        Circle(
            width - small / 2,
            height - small / 2,
            small / 2,
            fillColor=colors.HexColor(PRIMARY_SUB),
            strokeColor=None,
        )
    )
    d.add(
        Circle(
            diameter / 2 + diameter * (1 / 22),
            diameter / 2,
            diameter / 2,
            fillColor=colors.HexColor(PRIMARY),
            strokeColor=None,
        )
    )
    return d


def _no_padding(extra: list[tuple[Any, ...]]) -> list[tuple[Any, ...]]:
    base: list[tuple[Any, ...]] = [
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]
    return base + extra


def _hr(width: float = CONTENT_WIDTH, color_hex: str = LINE) -> Table:
    t = Table([[""]], colWidths=[width], rowHeights=[1])
    t.setStyle(
        TableStyle(
            _no_padding(
                [("LINEBELOW", (0, 0), (-1, -1), 1, colors.HexColor(color_hex))]
            )
        )
    )
    return t


def _chip(text: str, bg_hex: str, fg_hex: str, base_style: ParagraphStyle) -> Table:
    style = ParagraphStyle(
        f"chip-{text}-{fg_hex}",
        parent=base_style,
        textColor=colors.HexColor(fg_hex),
        leading=base_style.fontSize + 2,
    )
    t = Table([[Paragraph(escape(text), style)]])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(bg_hex)),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return t


def _chip_row(
    left_chips: list[Table], right_chip: Table | None, right_width: float = 74
) -> Table:
    """왼쪽 칩 묶음(자동폭) + 오른쪽 칩 1개(우측 정렬) — 처리 이력 카드 헤더 줄."""
    left = Table([left_chips], hAlign="LEFT")
    left.setStyle(TableStyle(_no_padding([("VALIGN", (0, 0), (-1, -1), "MIDDLE")])))
    row = [[left, right_chip or ""]]
    t = Table(row, colWidths=[CONTENT_WIDTH - right_width, right_width])
    t.setStyle(
        TableStyle(
            _no_padding(
                [
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                ]
            )
        )
    )
    return t


def _stat_cards(
    cards: list[tuple[str, str, str, str]],
    stat_value_style: ParagraphStyle,
    stat_label_style: ParagraphStyle,
) -> Table:
    """cards: (값, 라벨, 상단 강조선 색, 값 글자색) — components/StatCard.tsx와 같은 모양
    (상단 3px 강조선 + bg-primary/6, "취소" 카드처럼 테두리색과 글자색이 다를 수 있음)."""
    gap = 9
    col_width = (CONTENT_WIDTH - gap * (len(cards) - 1)) / len(cards)
    row: list[list[Paragraph] | str] = []
    widths: list[float] = []
    for i, (value, label, _border, text_color) in enumerate(cards):
        value_style = ParagraphStyle(
            f"stat-{i}", parent=stat_value_style, textColor=colors.HexColor(text_color)
        )
        row.append(
            [
                Paragraph(escape(str(value)), value_style),
                Paragraph(escape(label), stat_label_style),
            ]
        )
        widths.append(col_width)
        if i < len(cards) - 1:
            row.append("")
            widths.append(gap)
    t = Table([row], colWidths=widths)
    style: list[tuple[Any, ...]] = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 11),
        ("RIGHTPADDING", (0, 0), (-1, -1), 11),
    ]
    for i, (_value, _label, border, _text) in enumerate(cards):
        col = i * 2
        style.append(("BACKGROUND", (col, 0), (col, 0), colors.HexColor(PRIMARY_TINT)))
        style.append(("LINEABOVE", (col, 0), (col, 0), 3, colors.HexColor(border)))
    t.setStyle(TableStyle(style))
    return t


def _average_panel(
    label: str, value: str, label_style: ParagraphStyle, value_style: ParagraphStyle
) -> Table:
    t = Table(
        [
            [Paragraph(escape(label), label_style)],
            [Paragraph(escape(value), value_style)],
        ],
        colWidths=[CONTENT_WIDTH],
    )
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(PRIMARY_TINT)),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 13),
                ("RIGHTPADDING", (0, 0), (-1, -1), 13),
                ("TOPPADDING", (0, 0), (0, 0), 10),
                ("BOTTOMPADDING", (1, 0), (1, 0), 10),
            ]
        )
    )
    return t


def _distribution_bar(
    pct: float, color_hex: str, width: float = 230, height: float = 12
) -> Table:
    pct = max(0.0, min(100.0, pct))
    filled = round(width * pct / 100)
    empty = width - filled
    if filled <= 0:
        data, col_widths, bg = [[""]], [width], [SURFACE_CHIP]
    elif empty <= 0:
        data, col_widths, bg = [[""]], [width], [color_hex]
    else:
        data, col_widths, bg = [["", ""]], [filled, empty], [color_hex, SURFACE_CHIP]
    t = Table(data, colWidths=col_widths, rowHeights=[height])
    style = _no_padding([])
    for i, c in enumerate(bg):
        style.append(("BACKGROUND", (i, 0), (i, 0), colors.HexColor(c)))
    t.setStyle(TableStyle(style))
    return t


def _distribution_rows(
    rows: list[dict],
    label_style: ParagraphStyle,
    count_style: ParagraphStyle,
    label_width: float = 78,
    count_width: float = 96,
) -> Table:
    total = sum(r["count"] for r in rows) or 1
    bar_width = CONTENT_WIDTH - label_width - count_width - 16
    body = []
    for row in rows:
        pct = round(row["count"] / total * 100)
        color = TYPE_INK[row["type"]]
        label = Paragraph(
            escape(TYPES[row["type"]]),
            ParagraphStyle(
                "dist-label", parent=label_style, textColor=colors.HexColor(color)
            ),
        )
        count = Paragraph(f"{row['count']}건 {pct}%", count_style)
        body.append([label, _distribution_bar(pct, color, width=bar_width), count])
    t = Table(body, colWidths=[label_width, bar_width, count_width])
    t.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("ALIGN", (2, 0), (2, -1), "RIGHT"),
            ]
        )
    )
    return t


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
        title=f"ONCUE - {report_title}",
        author="ONCUE",
    )
    wordmark = ParagraphStyle(
        "wordmark",
        fontName="NanumGothic",
        fontSize=11,
        leading=13,
        textColor=colors.HexColor(PRIMARY_DEEP),
    )
    title = ParagraphStyle(
        "title",
        fontName="NanumGothic",
        fontSize=23,
        leading=31,
        textColor=colors.HexColor(PRIMARY_DEEP),
        spaceBefore=6,
        spaceAfter=16,
        wordWrap="CJK",
    )
    heading = ParagraphStyle(
        "heading",
        fontName="NanumGothic",
        fontSize=12,
        leading=18,
        textColor=colors.HexColor(INK_900),
        spaceBefore=16,
        spaceAfter=8,
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
    item_title = ParagraphStyle(
        "item_title",
        parent=body,
        fontSize=11,
        leading=16,
        textColor=colors.HexColor(INK_900),
        spaceAfter=4,
    )
    small = ParagraphStyle(
        "small",
        parent=body,
        fontSize=8,
        leading=12,
        textColor=colors.HexColor("#52636a"),
    )
    chip_style = ParagraphStyle(
        "chip_text", fontName="NanumGothic", fontSize=8, leading=10
    )
    stat_value = ParagraphStyle(
        "stat_value", fontName="NanumGothic", fontSize=19, leading=23
    )
    stat_label = ParagraphStyle(
        "stat_label",
        fontName="NanumGothic",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor(INK_600),
        spaceBefore=2,
    )
    avg_label = ParagraphStyle(
        "avg_label",
        fontName="NanumGothic",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor(INK_600),
    )
    avg_value = ParagraphStyle(
        "avg_value",
        fontName="NanumGothic",
        fontSize=20,
        leading=26,
        textColor=colors.HexColor(PRIMARY_ULTRA),
    )
    dist_count = ParagraphStyle(
        "dist_count",
        fontName="NanumGothic",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor(INK_900),
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
    header = Table(
        [[_brand_mark(13), Paragraph("ONCUE", wordmark)]],
        colWidths=[18, 100],
    )
    header.setStyle(TableStyle(_no_padding([("VALIGN", (0, 0), (-1, -1), "MIDDLE")])))
    story: list[Flowable] = [
        header,
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
    if admin:
        story.append(p("본인이 수행한 처리만 집계 · 단순 지원 참여 제외", small))
    story.extend([Spacer(1, 4), _hr(), Spacer(1, 14)])

    summary = data["summary"]
    average = summary["averageProcessingSeconds"]
    if admin:
        cards = [
            (summary["totalReports"], "처리한 신고", PRIMARY_ULTRA, PRIMARY_ULTRA),
            (summary["resolved"], "완료", PRIMARY, PRIMARY),
            (summary["cancelled"], "취소", PRIMARY_LIGHT, INK_500),
            (summary["totalActions"], "총 처리", PRIMARY_LIGHT, PRIMARY_LIGHT),
        ]
    else:
        cards = [
            (summary["total"], "전체 신고", PRIMARY_ULTRA, PRIMARY_ULTRA),
            (summary["resolved"], "완료", PRIMARY, PRIMARY),
            (summary["cancelled"], "취소", PRIMARY_LIGHT, INK_500),
        ]
    story.append(_stat_cards(cards, stat_value, stat_label))
    story.append(Spacer(1, 10))
    story.append(
        _average_panel(
            "평균 처리 시간",
            "-" if average is None else f"{round(average / 60)}분",
            avg_label,
            avg_value,
        )
    )

    story.append(p("현재 유형별 신고" if admin else "유형별 신고", heading))
    type_rows = [row for row in data["typeDistribution"] if row["count"] > 0]
    if type_rows:
        story.append(_distribution_rows(type_rows, body, dist_count))
    else:
        story.append(p("아직 처리한 신고가 없습니다.", small))

    story.append(p("처리 이력" if admin else "신고 내역", heading))
    if admin:
        story.append(
            p(
                f"전체 처리 {summary['totalActions']}회 · 담당 시작 {summary['claimed']}회 · "
                f"담당 해제 {summary['released']}회 · 분류 변경 {summary['classificationChanged']}회",
                small,
            )
        )
    if not data["items"]:
        story.append(p("선택한 기간의 신고가 없습니다.", small))

    for number, item in enumerate(data["items"], 1):
        if admin:
            status_bg = (
                CARD_BG_SOFT if item["currentStatus"] != "CANCELLED" else SURFACE_CHIP
            )
            header_row = _chip_row(
                [
                    _chip(
                        TYPES[item["currentType"]], SURFACE_CHIP, INK_600, chip_style
                    ),
                    _chip(ACTIONS[item["action"]], PRIMARY_TINT, PRIMARY, chip_style),
                ],
                _chip(
                    STATUS[item["currentStatus"]],
                    STATUS_TINT[item["currentStatus"]],
                    STATUS_TEXT[item["currentStatus"]],
                    chip_style,
                ),
            )
            section = [
                header_row,
                Spacer(1, 6),
                p(item["contentFinal"], item_title),
                p(
                    f"{display_time(item['occurredAt'])} · 구역: {item['zone']['name'] if item['zone'] else '미지정 구역'}"
                    + (
                        ""
                        if item["processingSeconds"] is None
                        else f" · 배정~완료 {round(item['processingSeconds'] / 60)}분"
                    ),
                    small,
                ),
            ]
            if item["note"]:
                section.append(p(f"메모 · {item['note']}", small))
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
                        p(
                            f"변경 · {field_names[change['field']]}: {before} → {after}",
                            small,
                        )
                    )
            card = Table([[section]], colWidths=[CONTENT_WIDTH])
            card.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(status_bg)),
                        (
                            "LINEBEFORE",
                            (0, 0),
                            (0, -1),
                            3,
                            colors.HexColor(STATUS_ACCENT[item["currentStatus"]]),
                        ),
                        ("TOPPADDING", (0, 0), (-1, -1), 11),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 11),
                        ("LEFTPADDING", (0, 0), (-1, -1), 14),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 11),
                    ]
                )
            )
            short_entry = len(item["contentFinal"]) + len(item["note"] or "") < 1000
            story.extend(
                [KeepTogether([card, Spacer(1, 9)])]
                if short_entry
                else [card, Spacer(1, 9)]
            )
            continue

        header_row = _chip_row(
            [_chip(TYPES[item["type"]["value"]], SURFACE_CHIP, INK_600, chip_style)],
            _chip(
                STATUS[item["status"]],
                STATUS_TINT[item["status"]],
                STATUS_TEXT[item["status"]],
                chip_style,
            ),
        )
        section = [
            header_row,
            Spacer(1, 6),
            p(item["contentFinal"], item_title),
            p(
                f"접수: {display_time(item['createdAt'])} | 구역: {item['zone']['name'] if item['zone'] else '미지정 구역'}",
                small,
            ),
            p(
                f"담당 배정: {display_time(item['claimedAt'])} | 완료: {display_time(item['resolvedAt'])}",
                small,
            ),
        ]
        card = Table([[section]], colWidths=[CONTENT_WIDTH])
        card.setStyle(
            TableStyle(
                [
                    (
                        "BACKGROUND",
                        (0, 0),
                        (-1, -1),
                        colors.HexColor(
                            CARD_BG_SOFT
                            if item["status"] != "CANCELLED"
                            else SURFACE_CHIP
                        ),
                    ),
                    (
                        "LINEBEFORE",
                        (0, 0),
                        (0, -1),
                        3,
                        colors.HexColor(STATUS_ACCENT[item["status"]]),
                    ),
                    ("TOPPADDING", (0, 0), (-1, -1), 11),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 11),
                    ("LEFTPADDING", (0, 0), (-1, -1), 14),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 11),
                ]
            )
        )
        story.extend(
            [KeepTogether([card, Spacer(1, 9)])]
            if len(item["contentFinal"]) < 1000
            else [card, Spacer(1, 9)]
        )

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor(LINE))
        canvas.setLineWidth(1)
        canvas.line(44, 38, A4[0] - 44, 38)
        canvas.setFont("NanumGothic", 8)
        canvas.setFillColor(colors.HexColor(INK_500))
        canvas.drawString(44, 25, "ONCUE · 개인 활동 내역")
        canvas.drawRightString(A4[0] - 44, 25, str(doc.page))
        canvas.restoreState()

    document.build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()
