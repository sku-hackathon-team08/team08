# 백엔드

Python 3.13과 FastAPI를 사용하며 uv로 가상환경·의존성을 관리합니다.
레이어 기반 모놀리식의 코드 배치와 DB 선택 상태는 [아키텍처](../docs/architecture.md)에서 확인합니다.

FastAPI 앱과 `/health`, 기본 테스트·CI를 구성했습니다. 환경 설정·SQLite/PostgreSQL 연결·세션 수명도 구현했으며 서비스 API·업무 테이블은 후속 작업입니다.
`app/main.py`는 앱 조립, `app/api/`는 라우터, `app/schemas/`는 데이터 계약을 담당합니다.
`app/core/config.py`는 환경 설정을 검증합니다. `app/db/session.py`는 DB 연결·세션을, `app/api/dependencies.py`는 요청별 세션 제공을 담당합니다. 서비스·업무 모델은 패키지 경계만 준비했으며, [허용 의존 방향](../docs/architecture.md#의존-방향)에 따라 기능을 추가합니다.

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
```

유닛 테스트는 DB URL 기본값·형식·비밀값의 일반 출력 가림을, 통합 테스트는 환경 설정 우선순위·앱 시작·health 응답을 확인합니다. DB 통합 테스트는 임시 SQLite와 별도 PostgreSQL에서 연결·세션 종료·미완료 저장 정리를 확인하고 SQLite의 파일 유지·FK 동작도 검사합니다.
CI는 `pytest` 한 번으로 두 폴더를 모두 수집하며, 테스트가 없는 결과를 통과로 바꾸지 않습니다.
분류 기준·폴더 구조·작성 권고는 [백엔드 테스트 가이드](../docs/guides/testing.md#백엔드-테스트)를 참고합니다.
실행 조건과 실패 시 확인할 내용은 [백엔드 CI 안내](../docs/guides/backend.md#ci)를 참고합니다.

패키지별 역할과 추가·갱신 방법은 [백엔드 개발 가이드](../docs/guides/backend.md)를 참고합니다.
작업 전 [문서 지도](../docs/index.md)에서 관련 기준 문서를 확인합니다.
