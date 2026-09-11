"""격리된 SQLite에 가상 처리 이력을 보존하고 실제 집계 서비스로 PDF를 반복 생성한다."""

import argparse
import asyncio
import os
import subprocess
import sys
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from uuid import NAMESPACE_URL, UUID, uuid5
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import BACKEND_ROOT, Settings
from app.db.session import open_database
from app.models.entry import Actor, Event, LoginSession
from app.models.reports import Analysis, Report, ReportLog
from app.services.activity_pdf import render_activity_pdf
from app.services.admin_activity import admin_activity_data
from app.services.entry import Identity

KST = ZoneInfo("Asia/Seoul")


def demo_id(name: str) -> UUID:
    return uuid5(NAMESPACE_URL, f"oncue/pdf-preview/v1/{name}")


def timestamp(value: datetime) -> str:
    return (
        value.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    )


async def seed_preview(db: AsyncSession, anchor: date) -> Identity:
    """고정 ID와 단일 트랜잭션으로 재실행해도 기존 목 데이터를 유지한다."""
    event = await db.get(Event, demo_id("event"))
    if event is not None:
        actor = await db.get(Actor, demo_id("admin"))
        session = await db.get(LoginSession, demo_id("session"))
        if actor is None or session is None:
            raise RuntimeError("목 데이터가 불완전합니다. 새 --db 경로를 사용하세요.")
        return Identity(actor, event, session)
    event = Event(
        id=demo_id("event"),
        name="ONCUE 가상 콘서트",
        code="PDFPREVIEW",
        map_id=UUID("69cbb93b-d6cb-5785-a7c8-e606c7279d3d"),
    )
    db.add(event)
    await db.flush()
    admin = Actor(
        id=demo_id("admin"),
        event_id=event.id,
        role="ADMIN",
        name="김온유 (가상)",
        team="현장 운영팀",
    )
    staff = Actor(
        id=demo_id("staff"),
        event_id=event.id,
        role="STAFF",
        name="이스태프 (가상)",
        team="안전 지원팀",
    )
    db.add_all([admin, staff])
    await db.flush()
    # 인증 가능한 고정 토큰을 만들지 않는다. 미리보기는 서비스에 Identity를 전달한다.
    session = LoginSession(
        id=demo_id("session"),
        actor_id=admin.id,
        token_hash=demo_id("unused-token").hex,
        revoked=True,
    )
    db.add(session)
    scenarios = [
        (
            "CROWD",
            "동문 입구 대기 줄이 보행 동선까지 이어졌습니다.",
            "안내선을 재배치하고 두 개의 입장 동선으로 분산했습니다.",
        ),
        (
            "FACILITY",
            "메인 무대 오른쪽 안내 스피커에서 소리가 나지 않습니다.",
            "음향팀과 케이블 연결을 점검하고 정상 출력을 확인했습니다.",
        ),
        (
            "LOST",
            "푸드존에서 보호자를 찾는 어린이를 발견했습니다.",
            "안내 부스에서 보호자 신원을 확인한 후 인계했습니다.",
        ),
        (
            "EMERGENCY",
            "객석 B구역 관람객이 어지럼증을 호소합니다.",
            "의료팀이 현장에서 상태를 확인하고 의무실로 동행했습니다.",
        ),
        (
            "OTHER",
            "서문 안내 표지의 운영 시간 확인 요청입니다.",
            "현장 안내판과 운영 공지를 대조해 안내했습니다.",
        ),
        (
            "FACILITY",
            "휴게 공간의 이동식 펜스 연결부가 느슨합니다.",
            "연결부 보강 후 안전 담당자와 통행 상태를 확인했습니다.",
        ),
        (
            "CROWD",
            "공연 종료 후 출구 주변에 관람객이 몰리고 있습니다.",
            "출구 안내 인력을 재배치했습니다. 병목 구간을 계속 관찰합니다.",
        ),
        (
            "LOST",
            "분실물 접수 내용이 앞선 신고와 동일합니다.",
            "기존 접수 건과 동일 물품임을 확인하여 중복 신고를 취소했습니다.",
        ),
        (
            "FACILITY",
            "푸드존 조명 점검을 다음 담당자에게 인계합니다.",
            "전기 담당자에게 현장 확인 결과를 전달했습니다.",
        ),
    ]
    current = datetime.now(KST)
    reference = (
        current
        if anchor == current.date()
        else datetime.combine(anchor, datetime.min.time(), KST).replace(hour=18)
    )
    for i, (kind, content, note) in enumerate(scenarios * 2):
        started = reference.replace(second=0, microsecond=0) - timedelta(
            days=i % 7, hours=i % 6, minutes=30 + (i * 7) % 40
        )
        ended = started + timedelta(
            minutes=4 + (i * 7) % 24, seconds=30 if i % 2 else 0
        )
        outcome = i % 9
        status = (
            "IN_PROGRESS"
            if outcome == 6
            else "CANCELLED"
            if outcome == 7
            else "RECEIVED"
            if outcome == 8
            else "RESOLVED"
        )
        analysis = Analysis(
            id=demo_id(f"analysis-{i}"),
            event_id=event.id,
            actor_id=staff.id,
            input_method="TEXT",
            status="READY",
            transcript_raw=content,
            content_suggested=content,
            type_suggested=kind,
            urgency_suggested="NORMAL",
        )
        db.add(analysis)
        await db.flush()
        report = Report(
            id=demo_id(f"report-{i}"),
            event_id=event.id,
            reporter_id=staff.id,
            analysis_id=analysis.id,
            content_final=content,
            status=status,
            type_value=kind,
            urgency_value="NORMAL",
            type_source="ADMIN_CONFIRMED",
            urgency_source="ADMIN_CONFIRMED",
            position={
                "lat": 37.568,
                "lng": 126.897,
                "captured_at": timestamp(started),
                "accuracy_meters": None,
            },
            position_source="DEMO_FIXED",
            zone={
                "id": str(demo_id(f"zone-{i % 3}")),
                "name": ["동문 입구", "메인 무대", "푸드존"][i % 3],
            },
            created_at=timestamp(started - timedelta(minutes=3)),
            claimed_by=None if outcome == 8 else admin.id,
            claimed_at=None if outcome == 8 else timestamp(started),
            resolved_at=timestamp(ended) if status == "RESOLVED" else None,
            resolve_note=note if status == "RESOLVED" else None,
            cancelled_at=timestamp(ended) if status == "CANCELLED" else None,
            cancelled_by=admin.id if status == "CANCELLED" else None,
            cancel_reason=note if status == "CANCELLED" else None,
        )
        db.add(report)
        await db.flush()
        actions: list[tuple[str, datetime, list[dict[str, str]], str | None]] = [
            (
                "REPORT_CLAIMED",
                started,
                [{"field": "status", "before": "RECEIVED", "after": "IN_PROGRESS"}],
                None,
            )
        ]
        if outcome == 1:
            actions.append(
                (
                    "CLASSIFICATION_CHANGED",
                    started + timedelta(minutes=2),
                    [{"field": "type", "before": "OTHER", "after": kind}],
                    "현장 확인 결과에 따라 시설 신고로 분류했습니다.",
                )
            )
        if outcome != 6:
            action = (
                "REPORT_CANCELLED"
                if outcome == 7
                else "ASSIGNMENT_RELEASED"
                if outcome == 8
                else "REPORT_RESOLVED"
            )
            actions.append(
                (
                    action,
                    ended,
                    [{"field": "status", "before": "IN_PROGRESS", "after": status}],
                    note,
                )
            )
        for j, (action, at, changes, memo) in enumerate(actions):
            db.add(
                ReportLog(
                    id=demo_id(f"log-{i}-{j}"),
                    report_id=report.id,
                    actor_id=admin.id,
                    occurred_at=timestamp(at),
                    action=action,
                    changes=changes,
                    note=memo,
                )
            )
        report.version = 1 + len(actions)
    await db.commit()
    return Identity(admin, event, session)


async def preview(db_path: Path, output: Path, anchor: date, period: str) -> None:
    async with open_database(
        Settings(_env_file=None, database_url=f"sqlite:///{db_path}")
    ) as database:
        async with database.sessions() as db:
            identity = await seed_preview(db, anchor)
            data = await admin_activity_data(db, identity, period)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(render_activity_pdf(data))
    print(
        f"DB: {db_path}\nPDF: {output}\n신고 {data['summary']['totalReports']}건 / 처리 {data['summary']['totalActions']}회"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--db", type=Path, default=BACKEND_ROOT / "data/pdf-preview.sqlite3"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=BACKEND_ROOT.parent / "output/pdf/admin-activity-report.pdf",
    )
    parser.add_argument(
        "--date",
        type=date.fromisoformat,
        default=datetime.now(KST).date(),
        help="최초 seed 기준일. 기존 DB는 보존합니다.",
    )
    parser.add_argument("--period", choices=["TODAY", "WEEK", "ALL"], default="ALL")
    args = parser.parse_args()
    db_path = args.db.resolve()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_ROOT,
        env={**os.environ, "DATABASE_URL": f"sqlite:///{db_path}"},
        check=True,
    )
    asyncio.run(preview(db_path, args.output.resolve(), args.date, args.period))


if __name__ == "__main__":
    main()
