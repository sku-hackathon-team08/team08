# 업무 저장·트랜잭션·마이그레이션

> 상태: [해커톤 계약](../api/hackathon.md)을 구현한 저장 구조. SQLAlchemy asyncio, SQLite와 PostgreSQL, Alembic을 사용합니다.

## 테이블

| 테이블 | 저장 책임 / 주요 제약 |
|---|---|
| events | 준비된 행사 이름·공통 진입 코드·지도 seed ID. 코드 UNIQUE |
| actors | 행사 FK·역할·이름·팀. 새 진입마다 UUIDv4, 동명이인 합치지 않음 |
| login_sessions | actor FK·토큰 SHA-256 UNIQUE·로그아웃 여부. 토큰 원문 저장 안 함 |
| idempotency_records | scope+key UNIQUE·입력 지문·응답 상태/본문/헤더. status null은 결과 미확정 |
| analyses | 행사/actor FK·입력 방식·상태·원문·최초 제안·실패 코드 |
| reports | 행사/신고자/분석 FK·버전·최종 내용·분류/확인자·위치·접수/담당/종결 정보. analysis_id UNIQUE |
| report_logs | 신고/행위자 FK·행위 종류·시각·공개 변경 전후·선택 메모 |
| support_requests | 신고/개설자 FK·개설/종료 시각·종료 사유. report_id의 closed_at IS NULL 부분 UNIQUE |
| participations | 지원요청/참여자 FK·시작/종료 시각·사유. 요청+actor의 ended_at IS NULL 부분 UNIQUE |

일반 PK는 백엔드 UUIDv4입니다. SQLAlchemy Uuid는 PostgreSQL의 UUID와 SQLite의 32자리 저장으로 변환하며 HTTP는 하이픈 UUID로 직렬화합니다. 공개 지도 seed의 기존 결정적 ID는 바꾸지 않습니다. 시간은 비교 가능한 UTC 밀리초 RFC3339 문자열(24자)로 저장합니다. 상태 목록 CHECK/native ENUM은 추가하지 않으며 입력 스키마·서비스의 고정 전이로 검증합니다. 삭제 연쇄나 자동 보존 만료는 없습니다.

DB의 FK·UNIQUE가 참조와 경합을 보장하며 행사/소유자 권한은 세션과 서비스 쿼리에서 함께 검사합니다. position JSON은 저장용 snake_case 구조이며 공개 DTO 직렬화와 구분합니다. 분석 원문·제안은 Report 최종 내용으로 덮어쓰지 않습니다.

## 트랜잭션

- 요청 의존성은 응답 본문 생성 후 백그라운드 작업 시작 전에 세션을 닫습니다. 서비스 작업을 호출한 HTTP 경계가 commit하며 실패 시 닫힌 세션은 rollback됩니다.
- 멱등 POST는 전용 서비스가 commit을 소유합니다. 짧은 최초 트랜잭션에서 키를 선점한 다음 업무 변경·이력·응답 결과를 함께 commit합니다. 경쟁 요청은 DB 유일성 제약 이후 기존 결과를 조회합니다.
- 공개 가능한 업무 거절은 업무 트랜잭션을 rollback한 다음 실패 결과만 저장합니다. 서버 오류·프로세스 중단처럼 결과가 불명확하면 pending 기록을 유지하고 자동 재실행하지 않습니다.
- PATCH/지원 POST는 `UPDATE reports SET version=version+1 WHERE id=:id AND version=:expected` 결과를 확인하고 해당 행 잠금 안에서 상태·권한·분류·지원·이력을 갱신합니다. 업무 거절은 버전 증가도 rollback합니다.
- 분석 1회 사용은 분석 행 쓰기 잠금과 reports.analysis_id UNIQUE로 보장합니다.
- 분석은 외부 제공자를 기다리는 동안 DB 세션·연결을 유지하지 않습니다. PENDING을 원자적으로 PROCESSING으로 선점한 뒤 세션을 닫고, 음성 원문·최종 결과 저장 시 각각 새 세션을 엽니다. 단일 프로세스 시작 시 남은 PENDING/PROCESSING을 FAILED로 처리합니다.

## 마이그레이션

백엔드 폴더에서 `uv run alembic upgrade head`로 빈 DB를 구성하거나 기존 DB를 갱신합니다. 설정은 앱과 같은 DATABASE_URL이며 기본은 backend/data/team08.sqlite3입니다. 앱 시작 시 create_all/drop_all을 호출하지 않습니다.

- `0001_entry_idempotency.py`: 행사·사용자·세션·멱등 결과.
- `0002_reports.py`: 분석·신고·이력·지원 및 부분 UNIQUE.
- `uv run alembic check`: ORM 메타데이터와 최종 DB의 차이 확인.
- `uv run python -m app.db.seed_demo`: 준비된 행사 코드 DEMO26 등록. 재실행 시 기존 행사를 사용하며 기존 데이터 초기화/갱신을 하지 않습니다.
- 스키마 변경은 새 revision으로 작성합니다. 업그레이드 전 실제 운영 DB는 별도 백업합니다. downgrade는 테이블을 제거할 수 있으므로 운영 데이터 복구 수단으로 사용하지 않습니다.

테스트는 임시 SQLite 파일과 독립 PostgreSQL 스키마를 사용합니다. migrations upgrade·반복 실행·check를 두 DB에서 확인하며 업무·권한·경합은 HTTP 통합 테스트로 검증합니다. 실제 앱 DB나 기존 데이터는 테스트 초기화 대상으로 사용하지 않습니다.
