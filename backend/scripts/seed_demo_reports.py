"""로컬 개발 DB(data/team08.sqlite3)의 신고 데이터를 지우고 시연용 데이터로 채운다.

events/actors/login_sessions는 건드리지 않는다(실제 로그인 세션이 끊기면 안 되므로) —
신고와 그 하위 데이터(analyses·report_logs·support_requests·participations)만 지우고
다시 채운다. 위치는 실제 콘서트 배치(플로어 A~D·무대백스테이지·음향조명운영·3개 게이트)
좌표를 그대로 써서 지도에 핀이 실제 구역 위에 올바르게 찍히게 한다.

재실행해도 항상 같은 10건으로 깨끗하게 맞춰진다(먼저 지우고 다시 채우는 구조라 멱등).

실행: uv run --directory backend python scripts/seed_demo_reports.py
"""

import asyncio
from datetime import UTC, datetime, timedelta
from uuid import NAMESPACE_URL, UUID, uuid5

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.db.session import open_database
from app.models.entry import Actor, Event
from app.models.reports import (
    Analysis,
    Participation,
    Report,
    ReportLog,
    SupportRequest,
)

EVENT_ID = UUID(
    "25ad0b5d-ad93-4539-8957-805af1a9e8b5"
)  # DEMO26 — 기존 이벤트 그대로 재사용


def demo_id(name: str) -> UUID:
    return uuid5(NAMESPACE_URL, f"oncue/demo-reports/v1/{name}")


def ts(value: datetime) -> str:
    return (
        value.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    )


# 실제 콘서트 배치 좌표(GET /demo/events/{id}/map 응답 기준, 2026-09-12 실측) — 플로어
# 구역 중심점과 게이트 위치를 그대로 썼다.
ZONE = {
    "floor_a": (
        37.5683379,
        126.8970395,
        "aa9d260d-0125-5c81-a99c-4cd24d0ae015",
        "플로어 A",
    ),
    "floor_b": (
        37.5682685,
        126.8974027,
        "42a03226-5e72-56ab-a513-467f26178744",
        "플로어 B",
    ),
    "floor_c": (
        37.5680628,
        126.8969565,
        "42a2eb18-ce7f-5e51-8e12-34ded6ad0562",
        "플로어 C",
    ),
    "floor_d": (
        37.5679934,
        126.8973197,
        "3c740f3a-b17d-51fd-a5c4-79a7df980e20",
        "플로어 D",
    ),
    "stage": (
        37.5685625,
        126.8972702,
        "d939b2ca-e205-5b3f-832e-b2b78a8bd4fe",
        "무대·백스테이지",
    ),
    "sound": (
        37.5678348,
        126.8970926,
        "d4c89036-ca9c-59bc-9c1e-3c6afb0e93e3",
        "음향·조명 운영",
    ),
}
GATE = {
    "west": (37.567899833, 126.896732726),
    "east": (37.567756807, 126.897481165),
    "ops": (37.568631552, 126.8969767),
}


async def wipe_reports(db: AsyncSession) -> None:
    # 자식 → 부모 순서로 지운다(외래키 순서).
    await db.execute(delete(Participation))
    await db.execute(delete(SupportRequest))
    await db.execute(delete(ReportLog))
    await db.execute(delete(Report))
    await db.execute(delete(Analysis))
    await db.flush()


async def ensure_actors(db: AsyncSession) -> dict[str, Actor]:
    specs = [
        ("admin", "ADMIN", "정현장", None),
        ("staff_safety_a", "STAFF", "이안전", "안전관리 A팀"),
        ("staff_safety_b", "STAFF", "박현장", "안전관리 B팀"),
        ("staff_facility", "STAFF", "최운영", "시설운영팀"),
        ("staff_medical", "STAFF", "한지원", "의료지원팀"),
    ]
    actors: dict[str, Actor] = {}
    for key, role, name, team in specs:
        actor_id = demo_id(f"actor-{key}")
        actor = await db.get(Actor, actor_id)
        if actor is None:
            actor = Actor(
                id=actor_id, event_id=EVENT_ID, role=role, name=name, team=team
            )
            db.add(actor)
        actors[key] = actor
    await db.flush()
    return actors


def position(lat: float, lng: float, captured_at: datetime) -> dict:
    return {
        "lat": lat,
        "lng": lng,
        "captured_at": ts(captured_at),
        "accuracy_meters": None,
    }


def zone_field(key: str | None) -> dict | None:
    if key is None:
        return None
    _, _, zone_id, name = ZONE[key]
    return {"id": zone_id, "name": name}


async def seed(db: AsyncSession) -> int:
    event = await db.get(Event, EVENT_ID)
    if event is None:
        raise RuntimeError(
            f"DEMO26 이벤트({EVENT_ID})를 찾을 수 없습니다 — 먼저 실제 DB로 로그인을 한 번 해서 이벤트를 만들어 두세요."
        )

    await wipe_reports(db)
    actors = await ensure_actors(db)
    now = datetime.now(UTC)

    # (키, 담당팀, 유형, 긴급도, 내용, 위치, created_at 기준 몇 분 전, 상태,
    #  claimed 몇 분 전(None=미배정), resolved/cancelled 몇 분 전, 메모)
    scenarios = [
        (
            "staff_medical",
            "EMERGENCY",
            "URGENT",
            "메인 스테이지 앞에서 관객이 쓰러져 의식이 없습니다.",
            ZONE["floor_a"][:2],
            6,
            "RECEIVED",
            None,
            None,
            None,
        ),
        (
            "staff_safety_a",
            "CROWD",
            "URGENT",
            "서측 게이트 앞에 인파가 몰려 압사 위험이 있습니다.",
            GATE["west"],
            9,
            "IN_PROGRESS",
            4,
            None,
            None,
        ),
        (
            "staff_facility",
            "FACILITY",
            "CAUTION",
            "음향·조명 운영 구역 스피커 타워가 불안정하게 흔들립니다.",
            ZONE["sound"][:2],
            2,
            "RECEIVED",
            None,
            None,
            None,
        ),
        (
            "staff_facility",
            "FACILITY",
            "CAUTION",
            "무대 백스테이지 전선이 바닥에 노출되어 있습니다.",
            ZONE["stage"][:2],
            28,
            "IN_PROGRESS",
            20,
            None,
            None,
        ),
        (
            "staff_safety_b",
            "CROWD",
            "CAUTION",
            "플로어 A와 B 사이 통로가 혼잡합니다.",
            ZONE["floor_b"][:2],
            35,
            "RESOLVED",
            30,
            15,
            "안내 인력을 배치해 통행로를 넓혔습니다.",
        ),
        (
            "staff_safety_b",
            "LOST",
            "NORMAL",
            "플로어 C에서 보호자를 찾는 아이를 발견했습니다.",
            ZONE["floor_c"][:2],
            55,
            "RESOLVED",
            50,
            40,
            "안내소에서 보호자 확인 후 인계했습니다.",
        ),
        (
            "staff_facility",
            "FACILITY",
            "NORMAL",
            "운영 진입 게이트 조명 일부가 꺼져 있습니다.",
            GATE["ops"],
            50,
            "RECEIVED",
            None,
            None,
            None,
        ),
        (
            "staff_safety_a",
            "OTHER",
            "NORMAL",
            "플로어 D 관람객이 화장실 위치를 문의했습니다.",
            ZONE["floor_d"][:2],
            75,
            "RESOLVED",
            72,
            60,
            "안내판 위치를 설명해 드렸습니다.",
        ),
        (
            "staff_safety_b",
            "FACILITY",
            "CAUTION",
            "동측 입장 게이트 울타리 연결부가 헐거워졌습니다.",
            GATE["east"],
            18,
            "CANCELLED",
            12,
            10,
            "동일 건 중복 접수로 취소했습니다.",
        ),
        (
            "staff_safety_a",
            "EMERGENCY",
            "URGENT",
            "음향·조명 운영 구역에서 화재 경보음이 울렸습니다.",
            (ZONE["sound"][0] + 0.00006, ZONE["sound"][1] + 0.00005),
            33,
            "RESOLVED",
            30,
            25,
            "오작동으로 확인, 경보를 해제했습니다.",
        ),
    ]

    zone_lookup = {
        (round(lat, 6), round(lng, 6)): key for key, (lat, lng, *_rest) in ZONE.items()
    }

    for i, (
        reporter_key,
        kind,
        urgency,
        content,
        (lat, lng),
        created_min_ago,
        status,
        claimed_min_ago,
        closed_min_ago,
        note,
    ) in enumerate(scenarios):
        created_at = now - timedelta(minutes=created_min_ago)
        reporter = actors[reporter_key]
        admin = actors["admin"]

        analysis = Analysis(
            id=demo_id(f"analysis-{i}"),
            event_id=EVENT_ID,
            actor_id=reporter.id,
            input_method="VOICE",
            status="READY",
            transcript_raw=content,
            content_suggested=content,
            type_suggested=kind,
            urgency_suggested=urgency,
        )
        db.add(analysis)
        await db.flush()

        zone_key = zone_lookup.get((round(lat, 6), round(lng, 6)))
        claimed_at = (
            created_at + timedelta(minutes=(created_min_ago - claimed_min_ago))
            if claimed_min_ago is not None
            else None
        )
        closed_at = (
            created_at + timedelta(minutes=(created_min_ago - closed_min_ago))
            if closed_min_ago is not None
            else None
        )

        report = Report(
            id=demo_id(f"report-{i}"),
            event_id=EVENT_ID,
            reporter_id=reporter.id,
            analysis_id=analysis.id,
            content_final=content,
            status=status,
            type_value=kind,
            urgency_value=urgency,
            type_source="AI_SUGGESTED",
            urgency_source="AI_SUGGESTED",
            position=position(lat, lng, created_at),
            position_source="DEMO_FIXED",
            zone=zone_field(zone_key),
            created_at=ts(created_at),
            claimed_by=admin.id if claimed_min_ago is not None else None,
            claimed_at=ts(claimed_at) if claimed_at else None,
            resolved_at=ts(closed_at) if status == "RESOLVED" and closed_at else None,
            resolve_note=note if status == "RESOLVED" else None,
            cancelled_at=ts(closed_at) if status == "CANCELLED" and closed_at else None,
            cancelled_by=admin.id if status == "CANCELLED" else None,
            cancel_reason=note if status == "CANCELLED" else None,
        )
        db.add(report)
        await db.flush()

        version = 1
        if claimed_at:
            db.add(
                ReportLog(
                    id=demo_id(f"log-{i}-claim"),
                    report_id=report.id,
                    actor_id=admin.id,
                    occurred_at=ts(claimed_at),
                    action="REPORT_CLAIMED",
                    changes=[
                        {
                            "field": "status",
                            "before": "RECEIVED",
                            "after": "IN_PROGRESS",
                        }
                    ],
                    note=None,
                )
            )
            version += 1
        if closed_at:
            action = "REPORT_RESOLVED" if status == "RESOLVED" else "REPORT_CANCELLED"
            db.add(
                ReportLog(
                    id=demo_id(f"log-{i}-close"),
                    report_id=report.id,
                    actor_id=admin.id,
                    occurred_at=ts(closed_at),
                    action=action,
                    changes=[
                        {"field": "status", "before": "IN_PROGRESS", "after": status}
                    ],
                    note=note,
                )
            )
            version += 1
        report.version = version

    await db.commit()
    return len(scenarios)


async def main() -> None:
    async with open_database(Settings()) as database:
        async with database.sessions() as db:
            count = await seed(db)
    print(f"신고 {count}건으로 새로 채웠습니다 (event={EVENT_ID}).")


if __name__ == "__main__":
    asyncio.run(main())
