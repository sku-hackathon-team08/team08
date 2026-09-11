# 백엔드

Python 3.13과 FastAPI를 사용하며 uv로 가상환경·의존성을 관리합니다.
레이어 기반 모놀리식의 코드 배치와 DB 선택 상태는 [아키텍처](../docs/architecture.md)에서 확인합니다.

FastAPI 서비스 API·업무 테이블·Alembic 마이그레이션과 SQLite/PostgreSQL 통합 테스트를 구현했습니다. 현재 범위와 실행 방법은 아래 해커톤 실행 안내 및 API 계약을 따릅니다.
`app/main.py`는 앱 조립, `app/api/`는 라우터, `app/schemas/`는 데이터 계약을 담당합니다.
`app/schemas/base.py`의 `ApiModel`은 API 별칭·직렬화와 내부 생성 메서드를 제공합니다. 요청·응답·쿼리 모델의 작성 방법과 입력 경계는 [API 필드 별칭 가이드](../docs/guides/backend.md#api-필드-별칭), 외부 필드 계약은 [API 네이밍](../docs/api/naming.md)을 참고합니다.
`app/schemas/errors.py`와 `app/api/errors.py`는 일반 HTTP 오류 스키마·핸들러를 제공하며 `main.py`에서 등록합니다. 현재 400·404·405·500을 적용하고 422 요청 검증은 schemas/validation.py·api/validation.py의 공통 필드 오류 응답으로 변환합니다. 적용 범위·남은 작업은 [공통 오류 계약](../docs/api/errors.md), 구현 책임은 [오류 처리 가이드](../docs/guides/backend.md#오류-처리-구현과-연동)에 있습니다.
`app/core/config.py`는 환경 설정을 검증하며 `app/core/logging.py`는 앱 로그를 설정합니다. `app/db/session.py`는 DB 연결·세션을, `app/api/dependencies.py`는 요청별 세션 제공을 담당합니다. 서비스·업무 모델은 패키지 경계만 준비했으며, [허용 의존 방향](../docs/architecture.md#의존-방향)에 따라 기능을 추가합니다.

## 환경 설치

[uv 설치 안내](https://docs.astral.sh/uv/getting-started/installation/)에 따라 uv를 설치합니다.
이번 설정은 uv 0.11.30으로 검증했습니다. Python 버전은 [`.python-version`](.python-version)의 3.13.14를 사용합니다.

저장소 루트에서 실행합니다.

```sh
cd backend
uv python install
uv sync --locked
uv run --locked python --version
```

`uv sync --locked`는 [잠금 파일](uv.lock)에 기록된 버전으로 개발 도구까지 설치합니다.
가상환경은 `backend/.venv/`에 생성되며, `uv run`을 사용하면 별도로 활성화할 필요가 없습니다.
실행용 패키지만 설치하려면 `uv sync --locked --no-dev`를 사용합니다.

## 설치 확인

아래 명령은 `backend/`에서 실행합니다.

```sh
uv lock --check
uv pip check
uv run --locked python -c "import fastapi, uvicorn; print('백엔드 의존성 설치 확인')"
uv run --locked pytest --version
uv run --locked ruff --version
uv run --locked pyrefly --version
```

## 환경 설정

기본 실행에는 `.env`가 필요하지 않습니다. 필요하면 `backend/`에서 예시를 복사합니다.

```sh
cp .env.example .env
```

| DATABASE_URL | 선택 결과 |
|---|---|
| 미설정 또는 빈 값 | `backend/data/team08.sqlite3`의 SQLite URL |
| `postgresql://username:password@localhost:5432/team08` | 지정한 PostgreSQL URL |
| `sqlite:///data/custom.sqlite3` | `backend/data/custom.sqlite3`의 SQLite URL |

실행 환경변수가 `backend/.env`보다 우선합니다. 둘 다 없으면 기본값을 사용합니다. 상대 SQLite 경로와 `.env` 위치는 실행 폴더와 관계없이 `backend/`를 기준으로 합니다. PostgreSQL URL 형식이 잘못되면 시작 시 설정 오류가 발생합니다.
앱 시작 시 DB에 실제 연결해 확인합니다. SQLite 폴더·파일이 없으면 생성하고 기존 파일과 데이터는 유지합니다. PostgreSQL을 지정했는데 연결할 수 없으면 시작에 실패하며 SQLite로 바꾸지 않습니다. `DATABASE_CONNECT_TIMEOUT_SECONDS`는 기본 10초(0 초과·최대 120초)입니다. 업무 테이블 자동 생성과 마이그레이션은 아직 없습니다.
실제 비밀값은 `.env.example`에 쓰지 않습니다. `.env`·로컬 SQLite 파일은 Git에서 제외합니다. 지원 URL 형식과 테스트 설정 교체 방법은 [환경 설정 가이드](../docs/guides/backend.md#환경-설정과-db-선택)에 있습니다.

기본 연결 풀은 유지 5개·추가 5개로 **엔진 하나당 최대 10개**이며 필요할 때 생성합니다. 풀 대기는 10초, 연결 대여 시 상태 확인은 켜져 있습니다. `.env.example`의 `DATABASE_POOL_SIZE`, `DATABASE_MAX_OVERFLOW`, `DATABASE_POOL_TIMEOUT_SECONDS`, `DATABASE_POOL_PRE_PING`으로 조정합니다. 워커를 늘리면 각각 풀이 생깁니다. 상세 기준은 [연결 풀 초기값](../docs/guides/backend.md#연결-풀-초기값)에 있습니다.

## 서버 실행

`backend/`에서 실행합니다.

```sh
uv run --locked uvicorn app.main:app --reload
```

- 앱 확인: [GET /health](http://127.0.0.1:8000/health)
- Swagger UI: [API 호출 확인](http://127.0.0.1:8000/docs)
- OpenAPI: [현재 구현 스키마](http://127.0.0.1:8000/openapi.json)

`/health`는 `200 OK`와 `{"status": "ok"}`를 반환합니다. 환경 설정은 앱 시작 시 검증되며 DB·API 키 설정 없이도 실행할 수 있습니다.
`--reload`는 로컬 개발용입니다. 배포 구성은 배포 환경을 정할 때 추가합니다.
API 계약은 [docs/api](../docs/api/index.md)에서 관리합니다.

## 코드 검사와 테스트

CI에서도 아래와 같은 명령을 실행합니다.

```sh
uv run --locked ruff check .
uv run --locked ruff format --check .
uv run --locked pyrefly check
uv run --locked pytest
```

PostgreSQL 없이 실행하면 해당 DB를 필요로 하는 사례만 사유와 함께 skip됩니다. CI는 PostgreSQL 17 서비스를 띄워 모두 실행합니다. 로컬에서 동일하게 검증하려면 별도 테스트 DB를 준비합니다.

```sh
docker run --rm -d --name team08-test-postgres \
  -e POSTGRES_USER=team08_test -e POSTGRES_PASSWORD=team08_test \
  -e POSTGRES_DB=team08_test -p 127.0.0.1:55432:5432 postgres:17-alpine
docker exec team08-test-postgres pg_isready -U team08_test -d team08_test
# accepting connections 확인 후 실행
TEST_DATABASE_URL=postgresql://team08_test:team08_test@127.0.0.1:55432/team08_test uv run --locked pytest
# 검증 종료 후 테스트 컨테이너 제거
docker stop team08-test-postgres
```

위 계정은 로컬 테스트 전용 예시입니다. `TEST_DATABASE_URL`은 앱의 `DATABASE_URL`과 별개이며 DB 이름은 `team08_test`여야 합니다. PostgreSQL 테스트 테이블은 연결별 임시 테이블로 격리합니다. 운영 DB·개발 DB를 테스트에 사용하지 않습니다.

테스트 범위를 골라 실행할 수도 있습니다. 아래 명령도 `backend/`에서 실행합니다.

```sh
uv run --locked pytest tests/unit
uv run --locked pytest tests/integration
uv run --locked pytest tests/integration/test_health.py
uv run --locked pytest tests/unit/test_schemas.py tests/integration/test_api_naming.py
uv run --locked pytest tests/unit/test_errors.py tests/integration/test_errors.py tests/integration/test_error_logging.py
```

유닛 테스트는 DB URL 기본값·형식·비밀값의 일반 출력 가림을, 통합 테스트는 환경 설정 우선순위·앱 시작·health 응답을 확인합니다. DB 통합 테스트는 임시 SQLite와 별도 PostgreSQL에서 연결·세션 종료·미완료 저장 정리를 확인하고 SQLite의 파일 유지·FK 동작도 검사합니다.
스키마 유닛 테스트는 내부 생성·검증·직렬화를, 네이밍 통합 테스트는 테스트 전용 앱에서 JSON·쿼리 입력 경계와 응답·OpenAPI의 필드명을 확인합니다.
오류 테스트는 일반 오류 모델과 ASGI 응답·헤더·HEAD·422 경계·OpenAPI를 확인합니다. 서버 오류 로그 테스트는 실제 Uvicorn에 HTTP 요청을 보내 원인 기록과 안전한 응답을 확인합니다.
CI는 `pytest` 한 번으로 두 폴더를 모두 수집하며, 테스트가 없는 결과를 통과로 바꾸지 않습니다.
분류 기준·폴더 구조·작성 권고는 [백엔드 테스트 가이드](../docs/guides/testing.md#백엔드-테스트)를 참고합니다.
실행 조건과 실패 시 확인할 내용은 [백엔드 CI 안내](../docs/guides/backend.md#ci)를 참고합니다.

패키지별 역할과 추가·갱신 방법은 [백엔드 개발 가이드](../docs/guides/backend.md)를 참고합니다.
작업 전 [문서 지도](../docs/index.md)에서 관련 기준 문서를 확인합니다.

## 로그 확인

앱 로그는 콘솔(stderr)에 출력하며 기본 레벨은 `INFO`입니다. `backend/.env`에 `LOG_LEVEL=DEBUG`처럼 대문자로 지정하거나 실행 환경변수로 덮어쓸 수 있습니다.

```bash
LOG_LEVEL=DEBUG uv run uvicorn app.main:app --reload
```

DB 연결 확인·풀 정리 완료와 명시적 HTTP 500의 안전한 진단은 앱에서, 앱 시작·종료·접근·lifespan 실패와 예상하지 못한 요청 오류의 원인·스택은 Uvicorn에서 기록합니다. `LOG_LEVEL`은 앱 로그에만 적용됩니다. Uvicorn 레벨은 `--log-level info`처럼 별도 지정합니다. 상세 기준과 서버 로그 노출 범위는 [기본 로깅](../docs/guides/backend.md#기본-로깅)을 참고합니다.

## 공개 콘서트 데모

행사 지도·구역·게이트·모델은 `demo/concert-layout.json`과 `demo/assets/`에서 관리합니다.
`uv run python scripts/build-concert.py`로 재생성하고,
`uv run uvicorn app.main:app --host 127.0.0.1 --port 8001`로 실행합니다.
프론트 담당자에게 8001 포트의 지도 API와 행사 ID를 전달합니다. 프론트 구현은 이 PR에 포함하지 않습니다.
[데모 API 계약](../docs/api/demo-map.md)과 [작업 기준](../docs/integrations/vworld-demo.md)을 참고하세요.
읽기 전용 공개 seed이며 제품 인증·업무 DB 저장 구현과 구분합니다.


## 해커톤 백엔드 실행

현재 범위와 요청/응답은 [해커톤 API](../docs/api/hackathon.md), DB는 [업무 저장](../docs/db/storage.md), AI는 [OpenAI 연동](../docs/integrations/openai.md)을 따릅니다. 행사 신청·발급/GPS/구역 판정/접근 경로는 이번 범위에서 제외했습니다.

backend 폴더에서 실행합니다.

```bash
uv sync --locked
uv run alembic upgrade head
uv run python -m app.db.seed_demo
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
```

코드는 `DEMO26`이며 ADMIN/STAFF가 공통으로 사용합니다. 관리자 별도 자격 확인 없이 진입 화면에서 역할을 선택하는 해커톤 정책입니다. 세션 토큰은 클라이언트에서 저장해 다음 요청에 Bearer로 전달하고 로그아웃은 DELETE /api/v1/sessions/me입니다. 새 진입은 동명이인이어도 새 사용자입니다.

OPENAI_API_KEY는 실행 환경·backend/.env에서 읽고 저장소 루트 .env의 키도 fallback으로 지원합니다. 키를 복사하거나 출력할 필요가 없습니다. 기본 분석 모델은 gpt-4.1-mini, STT는 gpt-transcribe이며 OPENAI_ANALYSIS_MODEL·OPENAI_TRANSCRIPTION_MODEL로 바꿀 수 있습니다.

CORS_ORIGINS는 JSON 문자열 배열입니다. 기본값은 http://localhost:5173 및 http://127.0.0.1:5173이며 배포 주소는 별도로 설정합니다. 허용 헤더는 Authorization·Content-Type·Idempotency-Key, 노출 헤더는 Location·Content-Disposition입니다.

앱 시작은 테이블을 만들지 않으므로 마이그레이션을 먼저 실행합니다. seed 명령을 다시 실행해도 기존 데이터를 초기화하지 않습니다. 단일 워커/인스턴스로 실행하며 재시작 때 중단된 분석은 실패로 처리합니다. `--reload`로 재시작되는 개발 환경에서도 실행 중 분석이 중단될 수 있습니다.

PDF는 번들 NanumGothic 폰트로 생성하며 별도 시스템 폰트 설치가 필요 없습니다. 폰트와 SIL OFL 라이선스는 assets/fonts에 있습니다. 원본: https://github.com/google/fonts/tree/main/ofl/nanumgothic

### 추가 검증

```bash
uv run alembic check
uv run ruff check .
uv run ruff format --check .
uv run pyrefly check
uv run pytest
```

TEST_DATABASE_URL을 전용 PostgreSQL team08_test DB로 설정하면 PostgreSQL 연결/격리된 업무 스키마 테스트를 함께 실행합니다. 설정하지 않으면 해당 테스트는 skip하며 SQLite만 검증합니다. 실제 기기·브라우저 UI·배포 검증과 제공자 대체 테스트는 구분합니다.


## PDF 디자인 반복 개발

별도 개발용 SQLite에 **가상 신고 18건·처리 로그 36건**을 저장하고 실제 관리자 집계 서비스로 PDF를 생성합니다. 나눔고딕을 유지하며 통계 요약·유형/행위 분포·날짜별 차트·처리 타임라인을 확인할 수 있습니다.

`backend/`에서 실행합니다. 이 명령은 `.env`의 업무 DB 대신 지정된 SQLite에 Alembic 마이그레이션과 seed를 실행하며 외부 AI를 호출하지 않습니다.

```sh
uv run --locked python -m scripts.preview_activity_pdf
```

- DB: `backend/data/pdf-preview.sqlite3`
- 결과: `output/pdf/admin-activity-report.pdf` (저장소 루트 기준)
- 재실행: 기존 데이터·수동 수정은 보존하고 현재 코드로 PDF만 다시 생성합니다.
- 시나리오: 긴급·시설·혼잡·미아/분실·기타 신고, 완료·진행·취소·해제·분류 변경.
- 목 세션은 인증용이 아닙니다. CLI가 DB를 조회해 집계 서비스를 직접 호출하며 API 권한·다운로드 계약은 통합 테스트에서 검증합니다.

특정 날짜를 기준으로 새 데이터셋을 만들거나 기간을 바꿀 수 있습니다. `--date`는 **새 DB에 처음 넣을 때만** 적용되며, 오늘·이번 주 필터는 실행 시점의 한국 시간을 사용합니다. 과거 기준일로 만들었다면 `--period ALL`로 확인합니다.

```sh
uv run --locked python -m scripts.preview_activity_pdf --db data/pdf-preview-v2.sqlite3 --date 2026-09-12
uv run --locked python -m scripts.preview_activity_pdf --period TODAY --output ../output/pdf/admin-today.pdf
```

PDF 생성 뒤 Poppler가 설치된 환경에서 PNG로 렌더링해 확인합니다. PDF와 QA 이미지는 Git에서 제외합니다.

```sh
mkdir -p ../tmp/pdfs
pdftoppm -scale-to 1400 -png ../output/pdf/admin-activity-report.pdf ../tmp/pdfs/admin-report
```

레이아웃은 `app/services/admin_activity_pdf.py`, 시나리오는 `scripts/preview_activity_pdf.py`에서 수정합니다. 시나리오를 수정한 뒤에는 새 `--db` 경로로 생성하고, 레이아웃만 수정했으면 같은 명령으로 재추출하면 됩니다. 집계·표현 기준은 [관리자 처리 리포트 명세](../docs/features/activity-report.md#pdf-통계타임라인-표현)를 따릅니다.
