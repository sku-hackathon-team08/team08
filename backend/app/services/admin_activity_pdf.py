"""관리자 처리 리포트: 통계 요약과 한국 시간 기준 처리 타임라인."""

from collections import Counter
from datetime import datetime, timedelta
from io import BytesIO
from math import ceil
from typing import Any
from xml.sax.saxutils import escape
from zoneinfo import ZoneInfo

from reportlab.graphics.shapes import Circle, Drawing, Line, Rect, String
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Flowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.services.activity_pdf import (
    ACTIONS,
    CARD_BG_SOFT,
    CONTENT_WIDTH,
    FONT_LOCK,
    FONT_PATH,
    INK_900,
    LINE,
    PRIMARY,
    PRIMARY_DEEP,
    PRIMARY_TINT,
    STATUS,
    TYPE_INK,
    TYPES,
    _brand_mark,
    _no_padding,
    _stat_cards,
)

KST = ZoneInfo("Asia/Seoul")
MUTED = "#586577"
ACTION_COLORS = {
    "REPORT_CLAIMED": PRIMARY,
    "ASSIGNMENT_RELEASED": "#64748B",
    "CLASSIFICATION_CHANGED": "#8760C9",
    "REPORT_RESOLVED": "#168263",
    "REPORT_CANCELLED": "#A15C43",
}


def local_time(value: str) -> datetime:
    return datetime.fromisoformat(value).astimezone(KST)


def duration_label(seconds: float | None) -> str:
    if seconds is None:
        return "집계 없음"
    minutes, remainder = divmod(round(seconds), 60)
    if not minutes:
        return f"{remainder}초"
    return f"{minutes}분 {remainder}초" if remainder else f"{minutes}분"


def activity_bins(items: list[dict]) -> list[tuple[str, int]]:
    """모든 이력을 최대 7개 연속 날짜 구간에 담는다. 빈 날짜도 포함한다."""
    counts = Counter(local_time(item["occurredAt"]).date() for item in items)
    if not counts:
        return []
    start, end = min(counts), max(counts)
    step = max(1, ceil(((end - start).days + 1) / 7))
    result = []
    while start <= end:
        stop = min(start + timedelta(days=step - 1), end)
        label = start.strftime("%m.%d")
        if stop != start:
            label += "-" + stop.strftime("%m.%d")
        count = sum(value for day, value in counts.items() if start <= day <= stop)
        result.append((label, count))
        start = stop + timedelta(days=1)
    return result


def filled_rect(
    x: float,
    y: float,
    width: float,
    height: float,
    *,
    rx: float,
    ry: float,
    color: colors.Color,
) -> Rect:
    rectangle = Rect(x, y, width, height, rx=rx, ry=ry)
    rectangle.fillColor = color
    rectangle.strokeColor = None
    return rectangle


def trend_chart(items: list[dict]) -> Drawing:
    bins = activity_bins(items)
    drawing = Drawing(CONTENT_WIDTH, 103)
    if not bins:
        return drawing
    maximum = max(count for _, count in bins)
    slot = CONTENT_WIDTH / len(bins)
    drawing.add(Line(0, 22, CONTENT_WIDTH, 22, strokeColor=colors.HexColor(LINE)))
    for index, (label, count) in enumerate(bins):
        center = slot * (index + 0.5)
        height = 51 * count / maximum
        drawing.add(
            filled_rect(
                center - 17,
                22,
                34,
                height,
                rx=4,
                ry=4,
                color=colors.HexColor(PRIMARY if count == maximum else "#A8BCFF"),
            )
        )
        drawing.add(
            String(
                center,
                28 + height,
                f"{count}회",
                fontName="NanumGothic",
                fontSize=9,
                textAnchor="middle",
                fillColor=colors.HexColor(INK_900),
            )
        )
        drawing.add(
            String(
                center,
                6,
                label,
                fontName="NanumGothic",
                fontSize=8,
                textAnchor="middle",
                fillColor=colors.HexColor(MUTED),
            )
        )
    return drawing


def paragraph(value: object, style: ParagraphStyle) -> Paragraph:
    return Paragraph(escape(str(value)).replace("\n", "<br/>"), style)


def distribution_panel(
    title: str,
    subtitle: str,
    rows: list[tuple[str, int, str]],
    total: int,
    width: float,
    styles: dict,
) -> list:
    flowables: list[Flowable] = [
        paragraph(title, styles["section"]),
        paragraph(subtitle, styles["small"]),
    ]
    for label, count, color in rows:
        pct = count / total * 100 if total else 0
        line = Table(
            [
                [
                    paragraph(label, styles["small"]),
                    paragraph(
                        f"{count} {'회' if title == '처리 행위 구성' else '건'} · {pct:.0f}%",
                        styles["right"],
                    ),
                ]
            ],
            colWidths=[width * 0.51, width * 0.49],
        )
        line.setStyle(TableStyle(_no_padding([])))
        bar = Drawing(width, 12)
        bar.add(
            filled_rect(
                0,
                5,
                width,
                4,
                rx=2,
                ry=2,
                color=colors.HexColor("#EDF0F5"),
            )
        )
        if count:
            bar.add(
                filled_rect(
                    0,
                    5,
                    width * pct / 100,
                    4,
                    rx=2,
                    ry=2,
                    color=colors.HexColor(color),
                )
            )
        flowables.extend([line, bar, Spacer(1, 3)])
    return flowables


def timeline_entry(item: dict, report_number: int, styles: dict) -> Table:
    color = ACTION_COLORS[item["action"]]
    marker = Drawing(12, 16)
    marker.add(
        Circle(
            0,
            9,
            4,
            fillColor=colors.HexColor(color),
            strokeColor=colors.white,
            strokeWidth=1.5,
        )
    )
    action_style = ParagraphStyle(
        "action", parent=styles["action"], textColor=colors.HexColor(color)
    )
    header = [
        paragraph(ACTIONS[item["action"]], action_style),
        paragraph(
            f"신고 {report_number:02d} · 현재 유형 {TYPES[item['currentType']]} · 현재 상태 {STATUS[item['currentStatus']]}",
            styles["small"],
        ),
    ]
    rows = [
        [
            [
                paragraph(
                    local_time(item["occurredAt"]).strftime("%H:%M"), styles["time"]
                ),
                paragraph(
                    local_time(item["occurredAt"]).strftime("%m.%d"), styles["small"]
                ),
            ],
            marker,
            header,
        ],
        ["", "", paragraph(item["contentFinal"], styles["body"])],
    ]
    meta = f"현재 구역 · {item['zone']['name'] if item['zone'] else '미지정 구역'}"
    if item["processingSeconds"] is not None:
        meta += f"   /   배정~완료 {duration_label(item['processingSeconds'])}"
    rows.append(["", "", paragraph(meta, styles["small"])])
    if item["note"]:
        rows.append(["", "", paragraph("처리 메모 · " + item["note"], styles["note"])])
    field_names = {"status": "상태", "type": "유형", "urgency": "위험도"}
    labels = {**STATUS, **TYPES, "URGENT": "긴급", "CAUTION": "주의", "NORMAL": "보통"}
    for change in item["changes"]:
        if change["field"] in field_names:
            before = labels.get(change["before"], change["before"] or "없음")
            after = labels.get(change["after"], change["after"] or "없음")
            rows.append(
                [
                    "",
                    "",
                    paragraph(
                        f"변경 · {field_names[change['field']]}: {before} → {after}",
                        styles["small"],
                    ),
                ]
            )
    # 행 단위 및 행 내부 분할을 허용한다. 긴 메모도 자르지 않고 다음 페이지로 잇는다.
    table = Table(
        rows,
        colWidths=[55, 17, CONTENT_WIDTH - 72],
        repeatRows=1,
        splitByRow=1,
        splitInRow=1,
        hAlign="LEFT",
    )
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (2, 0), (2, -1), colors.HexColor(CARD_BG_SOFT)),
                ("LINEAFTER", (0, 0), (0, -1), 1, colors.HexColor("#DCE3F0")),
                ("LEFTPADDING", (0, 0), (1, -1), 0),
                ("RIGHTPADDING", (0, 0), (1, -1), 0),
                ("LEFTPADDING", (2, 0), (2, -1), 12),
                ("RIGHTPADDING", (2, 0), (2, -1), 12),
                ("TOPPADDING", (0, 0), (-1, 0), 10),
                ("TOPPADDING", (0, 1), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, -1), (-1, -1), 10),
            ]
        )
    )
    return table


def render_admin_activity_pdf(data: dict) -> bytes:
    with FONT_LOCK:
        if "NanumGothic" not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont("NanumGothic", str(FONT_PATH)))
    base = ParagraphStyle(
        "base",
        fontName="NanumGothic",
        fontSize=10,
        leading=16,
        textColor=colors.HexColor(INK_900),
        wordWrap="CJK",
    )
    styles = {"body": base}
    style_options: dict[str, dict[str, Any]] = {
        "title": dict(
            fontSize=27,
            leading=36,
            spaceAfter=10,
            textColor=colors.HexColor(PRIMARY_DEEP),
        ),
        "section": dict(fontSize=12, leading=18, spaceAfter=6, keepWithNext=True),
        "small": dict(fontSize=8, leading=12, textColor=colors.HexColor(MUTED)),
        "right": dict(
            fontSize=8, leading=12, alignment=2, textColor=colors.HexColor(MUTED)
        ),
        "number": dict(fontSize=25, leading=32),
        "label": dict(fontSize=9, leading=14, textColor=colors.HexColor(MUTED)),
        "time": dict(fontSize=11, leading=16, textColor=colors.HexColor(MUTED)),
        "action": dict(fontSize=11, leading=17),
        "note": dict(fontSize=9, leading=15, textColor=colors.HexColor("#344761")),
        "day": dict(
            fontSize=13, leading=21, spaceBefore=12, spaceAfter=10, keepWithNext=True
        ),
    }
    for name, options in style_options.items():
        styles[name] = ParagraphStyle(name, parent=base, **options)
    output = BytesIO()
    document = SimpleDocTemplate(
        output,
        pagesize=A4,
        # Frame 안쪽 여백 6pt를 더하면 실제 콘텐츠 여백은 44pt이다.
        rightMargin=38,
        leftMargin=38,
        topMargin=43,
        bottomMargin=48,
        title="ONCUE - 내 처리 리포트",
        author="ONCUE",
    )
    summary = data["summary"]
    actor = data["actor"]
    items = sorted(
        data["items"],
        key=lambda item: (local_time(item["occurredAt"]), item["id"]),
        reverse=True,
    )
    brand = Table(
        [[_brand_mark(12), paragraph("ONCUE  /  ACTIVITY REPORT", styles["small"])]],
        colWidths=[25, CONTENT_WIDTH - 25],
        hAlign="LEFT",
    )
    brand.setStyle(TableStyle(_no_padding([])))
    story: list[Flowable] = [
        brand,
        Spacer(1, 18),
        paragraph("내 처리 리포트", styles["title"]),
        paragraph(f"{actor['name']} · {actor['team'] or '-'}", base),
        Spacer(1, 6),
    ]
    period = data["range"]
    if period["from"]:
        start = local_time(period["from"]).strftime("%Y.%m.%d")
        end = (local_time(period["to"]) - timedelta(days=1)).strftime("%Y.%m.%d")
        period_text = f"처리 기간: {start} - {end}"
    else:
        period_text = "처리 기간: 전체"
    story.extend(
        [
            paragraph(period_text + " · 한국 시간(KST)", styles["small"]),
            paragraph(
                "생성: " + local_time(data["asOf"]).strftime("%Y.%m.%d %H:%M"),
                styles["small"],
            ),
            Spacer(1, 20),
        ]
    )
    cards = [
        (f"{summary['totalReports']:,}", "처리한 신고 · 건", PRIMARY, PRIMARY_DEEP),
        (f"{summary['totalActions']:,}", "총 처리 행위 · 회", PRIMARY, PRIMARY_DEEP),
        (f"{summary['resolved']:,}", "완료 · 건", "#168263", "#168263"),
        (f"{summary['cancelled']:,}", "취소 · 건", "#A15C43", "#A15C43"),
    ]
    story.extend([_stat_cards(cards, styles["number"], styles["label"]), Spacer(1, 12)])
    average = Table(
        [
            [
                paragraph("평균 처리 시간", styles["label"]),
                paragraph(
                    duration_label(summary["averageProcessingSeconds"]),
                    styles["section"],
                ),
            ],
            [
                paragraph(
                    "본인이 완료한 신고의 최종 담당 배정부터 완료까지", styles["small"]
                ),
                paragraph(
                    "완료 중 배정·완료 시각이 확인된 건만 집계",
                    styles["right"],
                ),
            ],
        ],
        colWidths=[CONTENT_WIDTH * 0.57, CONTENT_WIDTH * 0.43],
    )
    average.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(PRIMARY_TINT)),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, 0), 10),
                ("BOTTOMPADDING", (0, -1), (-1, -1), 10),
            ]
        )
    )
    story.extend([average, Spacer(1, 16)])
    width = (CONTENT_WIDTH - 28) / 2
    types = [
        (TYPES[row["type"]], row["count"], TYPE_INK[row["type"]])
        for row in data["typeDistribution"]
    ]
    action_counts = Counter(item["action"] for item in items)
    actions = [
        (label, action_counts[key], ACTION_COLORS[key])
        for key, label in ACTIONS.items()
    ]
    panels = Table(
        [
            [
                distribution_panel(
                    "현재 유형별 신고",
                    "중복 제거한 신고 건수 기준",
                    types,
                    summary["totalReports"],
                    width,
                    styles,
                ),
                "",
                distribution_panel(
                    "처리 행위 구성",
                    "같은 신고의 여러 처리 행위를 각각 집계",
                    actions,
                    summary["totalActions"],
                    width,
                    styles,
                ),
            ]
        ],
        colWidths=[width, 28, width],
    )
    panels.setStyle(TableStyle(_no_padding([("VALIGN", (0, 0), (-1, -1), "TOP")])))
    story.extend([panels, Spacer(1, 12)])
    if items:
        story.extend(
            [
                paragraph("날짜별 처리 활동", styles["section"]),
                paragraph(
                    "처리 횟수 · 이력이 있는 첫날부터 마지막 날까지, 긴 기간은 날짜 구간별 합계",
                    styles["small"],
                ),
                trend_chart(items),
            ]
        )
    else:
        story.append(paragraph("선택한 기간의 신고가 없습니다.", base))
    story.extend(
        [
            Spacer(1, 8),
            paragraph(
                "집계 기준 · 본인이 수행한 처리만 포함하며 단순 지원 참여는 제외합니다.",
                styles["small"],
            ),
        ]
    )
    if items:
        story.extend(
            [
                PageBreak(),
                paragraph("처리 타임라인", styles["title"]),
                paragraph(
                    "최신 처리부터 · 날짜와 시간은 한국 시간(KST) · 처리 로그 1건당 1개 항목",
                    styles["small"],
                ),
                paragraph(
                    "신고 내용·유형·상태·구역은 현재 값이며, 행위·변경 내역·메모는 처리 당시 기록입니다.",
                    styles["small"],
                ),
            ]
        )
    report_numbers = {}
    day_counts = Counter(local_time(row["occurredAt"]).date() for row in items)
    day = None
    for item in items:
        current_day = local_time(item["occurredAt"]).date()
        entry: list[Flowable] = []
        if current_day != day:
            day = current_day
            count = day_counts[day]
            day_heading = paragraph(
                f"{day:%Y.%m.%d}   /   처리 {count}회", styles["day"]
            )
            # 첫 항목과 직접 묶는다. 중첩 KeepTogether는 날짜만 남길 수 있다.
            day_heading.keepWithNext = False
            entry.append(day_heading)
        number = report_numbers.setdefault(item["reportId"], len(report_numbers) + 1)
        entry.extend([timeline_entry(item, number, styles), Spacer(1, 9)])
        height = sum(
            flow.wrap(CONTENT_WIDTH, document.height)[1]
            + flow.getSpaceBefore()
            + flow.getSpaceAfter()
            for flow in entry
        )
        if height <= document.height - 12:
            story.append(KeepTogether(entry))
        else:
            # 한 페이지보다 큰 항목은 현재 페이지부터 바로 나눠 빈 페이지를 피한다.
            story.extend(entry)

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor(LINE))
        canvas.line(44, 37, A4[0] - 44, 37)
        canvas.setFont("NanumGothic", 8)
        canvas.setFillColor(colors.HexColor(MUTED))
        canvas.drawString(44, 24, "ONCUE · 개인 처리 리포트")
        canvas.drawRightString(A4[0] - 44, 24, f"{doc.page:02d}")
        if doc.page > 1:
            canvas.drawString(44, A4[1] - 28, "ACTIVITY TIMELINE  /  처리 이력")
        canvas.restoreState()

    document.build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()
