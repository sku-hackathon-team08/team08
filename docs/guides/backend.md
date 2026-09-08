# 백엔드 개발

> 상태: 최소 앱·상태 확인 API·테스트·CI를 구성했습니다. DB 연결·세션과 시작/종료 처리, API 공통 스키마·입력 경계를 구현했으며 서비스 API·업무 모델은 후속 작업입니다.

## 현재 의존성

| 구분 | 패키지 | 역할 |
|---|---|---|
| 실행 | FastAPI | API 애플리케이션 프레임워크 |
| 실행 | Pydantic | 요청·응답 데이터 모델과 입력 검증 |
| 실행 | pydantic-settings | 환경변수·로컬 .env 로딩과 설정 검증 |
| 실행 | SQLAlchemy asyncio | 비동기 엔진·세션과 향후 ORM |
| 실행 | aiosqlite | SQLite 비동기 드라이버 |
| 실행 | psycopg binary | PostgreSQL 비동기 드라이버 |
| 실행 | Uvicorn | FastAPI 앱을 실행하는 서버 |
| 개발 | pytest | 테스트 실행 |
| 개발 | HTTPX | AsyncClient·ASGITransport로 앱을 호출하는 테스트 클라이언트 |
| 개발 | AnyIO | pytest에서 asyncio 기반 비동기 테스트 실행 |
| 개발 | Ruff | 코드 포맷·오류·import 정렬 검사 |
| 개발 | Pyrefly | 함수 인자·반환값·변수의 타입 일치 검사 |

실행 패키지는 `backend/pyproject.toml`의 `project.dependencies`, 개발 도구는 `dependency-groups.dev`로 구분합니다.
배포할 웹 애플리케이션이므로 현재는 Python 배포 패키지를 만드는 빌드 설정을 추가하지 않습니다.
FastAPI와 Uvicorn은 필요한 기본 패키지만 설치합니다. 추가 기능은 사용 시점에 의존성을 보완합니다.
DB 접근은 SQLAlchemy asyncio·aiosqlite·psycopg를 사용합니다. LangGraph·인증 라이브러리는 기능을 구현할 때 선택합니다.
데이터 모델 설계는 [DB 설계 가이드](database.md)의 확정 선택·권장사항을 따르고 실제 구조는 [DB 명세](../db/index.md)에 기록합니다.

## 환경 설정과 DB 선택

> 상태: 설정 로딩·URL 검증과 실제 DB 연결·SQLite 파일 생성·시작 실패 및 종료 정리를 구현했습니다. 업무 테이블·마이그레이션은 후속 작업입니다.

`app/core/config.py`의 `Settings`는 `pydantic-settings`를 사용합니다. `main.py`의 `create_app()`이 앱을 구성하고 lifespan 시작 시 설정을 읽어 `app.state.settings`에 보관합니다. 설정 오류가 있으면 시작을 중단합니다. import만으로 `.env`를 읽거나 DB를 열지 않습니다.

| 항목 | 적용 기준 |
|---|---|
| 설정값 | `DATABASE_URL` 하나로 DB 대상을 선택 |
| 우선순위 | Python에서 명시한 설정값 → 실행 환경변수 → `backend/.env` → 기본값 |
| 미설정·빈 값 | 앞뒤 공백 제거 후 빈 값이면 `backend/data/team08.sqlite3`의 절대 SQLite URL 선택 |
| PostgreSQL | `postgresql://` 또는 `postgres://`. 호스트·DB 이름을 요구하며 `postgres://`는 `postgresql://`로 통일 |
| SQLite | `sqlite:///data/team08.sqlite3`처럼 파일 URL 사용. 상대 경로는 항상 `backend/` 기준으로 절대 경로화 |
| 잘못된 URL | 지원하지 않는 스킴·형식은 설정 오류. SQLite 기본값으로 대체하지 않음 |

`backend/.env`는 소스 파일 위치를 기준으로 찾습니다. 현재 실행 폴더의 `.env`를 자동 탐색하지 않습니다. 실행 환경변수에 빈 `DATABASE_URL`을 지정하면 `.env`의 PostgreSQL 값보다 우선해 SQLite를 선택합니다.
PostgreSQL URL에는 포트·연결 옵션 쿼리를 사용할 수 있습니다. 비밀번호의 `@`·`#` 등 URL 예약 문자는 percent-encoding합니다. 드라이버 접미사(`+asyncpg` 등)는 아직 받지 않으며 DB 레이어가 내부에서 `sqlite+aiosqlite` 또는 `postgresql+psycopg`로 변환합니다.
SQLite는 일반 파일 경로만 지원하며 메모리 DB·쿼리 옵션·fragment는 받지 않습니다. 설정 로딩은 디렉터리·파일 생성이나 연결 상태 확인을 수행하지 않습니다.

테스트는 `Settings(_env_file=None, database_url=...)`로 `.env`와 환경변수의 영향을 분리하고 `create_app(settings)`에 주입할 수 있습니다. 설정을 전역 캐시하지 않으며 앱마다 검증한 설정을 보관합니다. 테스트에서도 lifespan을 실행해 시작 시 검증을 확인합니다.
`Settings`는 변경 불가능한 객체로 사용하고 URL은 `SecretStr`로 보관해 일반 출력·JSON 직렬화에서 가립니다. 원문 추출은 DB 연결 경계에 한정하고 로그에 남기지 않습니다. 검증 오류의 일반 출력은 입력을 숨기지만 `ValidationError.errors()` 같은 구조화 오류를 그대로 로깅하지 않습니다.
`.env`의 다른 항목은 무시하는 설정이며, 이는 HTTP 요청의 미등록 필드 정책과 별개입니다.

설치·환경변수 예시는 [백엔드 README](../../backend/README.md#환경-설정), 설정 API는 [Pydantic Settings 공식 문서](https://docs.pydantic.dev/latest/concepts/pydantic_settings/)를 참고합니다.

## DB 연결과 세션 수명

`app/db/session.py`의 `open_database()`가 비동기 엔진·세션 팩토리를 제공하고 `main.py`가 lifespan에 연결합니다. SQLAlchemy asyncio는 SQLite와 PostgreSQL의 연결·세션 인터페이스를 공유하기 위해 선택했습니다. SQLite 드라이버는 aiosqlite, PostgreSQL은 비동기 연결과 일반적인 PostgreSQL 연결 옵션을 지원하는 psycopg 3의 binary 배포판을 사용합니다.

- 시작 시 SQLite의 상위 폴더를 준비하고 연결하면서 파일을 생성합니다. 기존 파일은 재사용하며 업무 테이블을 자동 생성하거나 데이터를 초기화하지 않습니다.
- PostgreSQL 설정이 있으면 해당 서버에 연결합니다. 실패해도 SQLite로 전환하지 않습니다.
- `DATABASE_CONNECT_TIMEOUT_SECONDS`는 연결과 초기 확인의 제한 시간입니다. 기본 10초, 0 초과·최대 120초의 유한한 값을 받습니다. 시작 시 `SELECT 1`을 확인하고 실패하면 안전한 오류로 시작을 중단합니다.
- SQLite는 새 연결마다 FK 제약을 활성화합니다. FK 인덱스나 삭제 정책을 자동 지정한다는 뜻은 아닙니다.
- 앱 종료·시작 실패 시 엔진의 연결 풀을 정리합니다. `/health`는 기존 응답을 유지하며 매 요청마다 DB에 접속하는 준비 상태 검사가 아닙니다.
- `api/dependencies.py`의 `get_session()`은 요청마다 세션을 제공하고 종료합니다. 같은 세션을 서로 다른 동시 작업에 공유하지 않습니다.
- 의존성은 commit하지 않습니다. 닫힐 때 미완료 트랜잭션은 정리되므로 저장 성공을 원하면 향후 합의할 업무 경계에서 명시적으로 완료해야 합니다. commit 담당 계층의 보류를 이번 세션 수명 관리로 확정하지 않습니다.

ORM 기반 모델은 실제 모델 도입 시 `models/base.py`에 둡니다. 범용 CRUD·업무 테이블·마이그레이션은 현재 추가하지 않습니다.
공식 근거: [SQLAlchemy asyncio](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html), [SQLite FK](https://docs.sqlalchemy.org/en/20/dialects/sqlite.html#foreign-key-support), [psycopg 연결](https://docs.sqlalchemy.org/en/20/dialects/postgresql.html#module-sqlalchemy.dialects.postgresql.psycopg).

### 연결 풀 초기값

SQLite 파일 DB와 PostgreSQL 모두 아래 시작값을 사용하며 `core/config.py`에서 읽어 `db/session.py`의 엔진 생성에 적용합니다. 부하 측정으로 검증한 최적값은 아니며 해커톤 초기 연결 상한을 작게 잡은 값입니다.

| 환경변수 | 기본값 | 의미 |
|---|---|---|
| `DATABASE_POOL_SIZE` | `5` | 풀에 유지할 연결 수. 1 이상 |
| `DATABASE_MAX_OVERFLOW` | `5` | 필요할 때 추가할 연결 수. 0 이상, 무제한 설정은 받지 않음 |
| `DATABASE_POOL_TIMEOUT_SECONDS` | `10` | 모든 연결이 사용 중일 때 반환을 기다리는 시간. 양의 유한한 값 |
| `DATABASE_POOL_PRE_PING` | `true` | 기존 연결을 빌릴 때 유효성을 확인하고 끊긴 연결 교체 |

연결은 필요할 때 생성하며 시작부터 10개를 열지 않습니다. 상한은 **엔진 하나당 5 + 5 = 10개**입니다. 워커·인스턴스를 늘리면 각각 풀이 생기므로 전체 연결 상한과 다른 DB 사용자의 연결 수를 함께 계산합니다. SQLite 연결 수를 늘려도 동시에 여러 쓰기를 처리할 수 있다는 뜻은 아닙니다.
풀 대기 시간은 빈 연결을 기다리는 시간이며 새 연결·ping·쿼리의 전체 제한 시간이 아닙니다. `DATABASE_CONNECT_TIMEOUT_SECONDS`는 기존처럼 앱 시작 시 연결 확인을 제한합니다. `pre_ping`도 이미 실행 중인 트랜잭션의 연결 장애를 복구하거나 작업을 자동 재시도하지 않습니다.
`pool_recycle`은 서버의 연결 만료 정책이 아직 정해지지 않아 기본 비활성 상태를 유지합니다. 실제 배포 환경에서 필요할 때 정합니다.
공식 동작은 [SQLAlchemy 연결 풀](https://docs.sqlalchemy.org/en/20/core/pooling.html)을 참고합니다.


## 기본 로깅

> 상태: Python 표준 logging으로 DB 준비·정리 완료 로그와 환경별 레벨 설정을 구현했습니다. HTTP 오류 핸들러·외부 로그 수집은 후속 작업입니다.

`core/logging.py`가 `app` 로거에 콘솔(stderr) 핸들러 하나를 구성합니다. lifespan에서 설정 검증 후 DB를 열기 전에 초기화하며, import·`create_app()` 호출만으로는 로깅 설정을 바꾸지 않습니다. 반복 초기화 시 같은 핸들러를 재사용하고 레벨을 갱신합니다. 로거는 프로세스 공통이므로 같은 프로세스에서 여러 앱을 실행하면 마지막 초기화의 레벨을 공유합니다.

`LOG_LEVEL`은 기본 `INFO`이며 대문자 `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`을 받습니다. 설정 우선순위는 다른 환경 설정과 같습니다. 앱 로그는 UTC 시각·레벨·모듈·메시지를 출력합니다.

```text
2026-09-08T00:00:00Z INFO app.db.session: DB 연결 확인 완료 (sqlite)
2026-09-08T00:01:00Z INFO app.db.session: DB 연결 풀 정리 완료
```

| 레벨 | 기록 기준 |
|---|---|
| DEBUG | 개발 중 필요한 상세 진단. 현재 별도 상세 이벤트 없음 |
| INFO | `SELECT 1` 성공 후 DB 준비 완료, `dispose()` 성공 후 풀 정리 완료 |
| WARNING | 계속 실행할 수 있지만 확인이 필요한 상황. 현재 별도 이벤트 없음 |
| ERROR | 앱 시작·종료 실패. Uvicorn이 lifespan 예외와 스택을 기록 |
| CRITICAL | 프로세스를 유지할 수 없는 심각한 오류. 현재 별도 이벤트 없음 |

앱 시작·종료와 HTTP 접근 로그는 Uvicorn 기본 로그를 사용합니다. 앱에서는 같은 메시지를 추가하지 않으며, `app` 로그의 root 전파를 막아 중복 출력을 방지합니다. root·Uvicorn·외부 라이브러리의 핸들러와 레벨은 변경하지 않습니다. `LOG_LEVEL`은 앱 로그에만 적용되며 Uvicorn은 `--log-level`로 별도 조정합니다.

### 오류 기록과 노출 범위

- 시작 실패는 기존 `DatabaseStartupError`, 풀 정리 실패는 `DatabaseShutdownError`로 변환해 Uvicorn에 전달합니다. 드라이버 원본 메시지 대신 오류 종류와 안전한 안내를 남기고, 앱에서 같은 예외를 먼저 로깅한 뒤 다시 던지지 않습니다. 오류 스택과 Uvicorn의 종료 안내는 서로 다른 정보입니다.
- DB URL·접속 비밀번호·토큰·SQL 파라미터·요청 본문을 새 앱 로그에 넣지 않습니다. 모든 문자열을 자동으로 가리는 필터를 구현한 것은 아니므로, 이후 로그에서도 원본 입력·설정 객체·예외 메시지를 무조건 기록하지 않습니다.
- Uvicorn 접근 로그에는 요청 경로·쿼리가 포함될 수 있으므로 URL에 비밀값을 전달하지 않습니다. 접근 로그 마스킹·정책 변경은 이번 범위에 포함하지 않습니다.
- 앞으로 HTTP 오류 핸들러가 예외를 처리한다면 한 경계에서 한 번 기록하고, 클라이언트 응답은 [오류 계약](../api/errors.md)을 따릅니다. 현재는 공통 HTTP 오류 핸들러나 응답 형식을 변경하지 않습니다.
- 풀 정리 완료는 `dispose()`가 성공했다는 의미이며, 사용 중인 연결의 강제 회수나 강제 종료 시 정리 보장을 뜻하지 않습니다. 요청 취소·실제 종료 신호 테스트는 후속 보완입니다.

파일 저장·외부 수집·분산 추적·요청별 추가 로그는 필요할 때 도입합니다. 동작 참고: [Python logging](https://docs.python.org/3.13/library/logging.html), [Uvicorn 설정](https://www.uvicorn.org/settings/).

## 기능 추가 순서

폴더 책임과 허용 import 방향은 [아키텍처](../architecture.md#의존-방향)를 기준으로 합니다.

1. `docs/api/`와 관련 기능 문서에 기대 동작을 정하고, [스키마 작성 패턴](#스키마-작성-패턴)을 참고해 `schemas/<기능>.py`에 데이터 계약을 작성합니다.
2. 업무 규칙은 `services/<기능>.py`에 둡니다. 저장이 필요하면 모델·연결 구성을 정하고 필요한 조회·저장 책임을 구현합니다.
3. `api/routes/<기능>.py`에서 HTTP 입력을 서비스에 전달하고 응답을 만듭니다.
4. `api/router.py`에 라우터를 등록하고, 실제 앱을 호출하는 테스트를 `tests/integration/`에 추가합니다. 분리한 업무 로직은 `tests/unit/`에서 검증하며 [테스트 분류 기준](testing.md#백엔드-테스트)을 따릅니다.
5. [의존 방향·순환 참조 규칙](../architecture.md#순환-참조를-막는-규칙)과 기존 검사 명령을 확인합니다.

업무 로직이 없는 상태 확인 API는 서비스·리포지토리 없이 라우터·스키마만 사용합니다.
아직 기능이 없는 패키지는 그대로 두고, 가짜 DB 연결·기본 CRUD·더미 서비스를 채우지 않습니다.

## 스키마 작성 패턴

> 적용: 작성 패턴은 권고사항입니다. 이미 확정한 [API 네이밍](../api/naming.md)과 [레이어 의존 방향](../architecture.md#의존-방향)은 해당 기준을 따릅니다. 공통 기반 모델 `ApiModel`을 구현했습니다.

### 위치와 이름

기능별 스키마는 `backend/app/schemas/<기능>.py`에 모으고 길어지면 기능 패키지로 나누는 방식을 권장합니다. 필요한 모델부터 작성합니다.
아래 `User`는 이름 설명용 예시이며 실제 사용자 기능을 추가한다는 뜻이 아닙니다.

| 목적 | 권장 이름 | 작성 기준 |
|---|---|---|
| 생성 요청 | `UserCreateRequest` | 클라이언트가 입력할 필드 |
| 수정 요청 | `UserUpdateRequest` | 실제로 수정 가능한 필드. 생성 요청과 별도 정의 |
| 단건 응답 | `UserResponse` | 공개할 필드 |
| 목록 응답 | `UserListResponse` | 목록 외 페이지 정보 등으로 감싸는 계약이 필요할 때만 추가 |

목록·상세의 공개 필드가 다르면 `UserSummaryResponse`·`UserDetailResponse`처럼 목적을 드러내는 별도 모델을 고려합니다. 공통 목록 포맷·페이지 방식·성공 응답 포장을 이 이름 규칙으로 확정하지 않습니다.

### 모델 분리와 공통 설정

- 요청과 응답 모델을 분리하는 방식을 권장합니다. 서버가 생성하는 ID나 서버가 판단하는 권한 등은 생성 요청의 필드에 자동으로 포함하지 않습니다.
- API용 공통 기반 모델은 `schemas/base.py`의 `ApiModel`입니다. 별칭·직렬화 설정과 내부 생성 메서드를 제공하며 `id`·생성 시각·업무 필드, 전역 `extra`·`strict`·ORM 설정은 넣지 않습니다.
- 같은 의미·검증 조건의 필드 묶음이 반복될 때만 공통 모델이나 중첩 모델을 고려합니다. 응답 모델이 생성 요청을 그대로 상속하는 등 서로 다른 목적을 중복 제거만을 위해 결합하지 않습니다.
- PATCH의 생략·null 의미는 해당 API를 설계할 때 정합니다. 생성 모델의 필드를 일괄 선택값으로 바꾸는 자동 생성 패턴은 기본으로 도입하지 않습니다.

### 생성과 변환 책임

| 상황 | 권장 패턴 |
|---|---|
| Python 코드에서 모델 생성 | `Model.from_internal(display_name=...)`처럼 `snake_case` 키워드 인자로 필요한 값을 명시 |
| 사전 등 외부 데이터를 모델로 변환 | 입력 경계에서 `model_validate()` 등 검증 경로 사용. `model_construct()`로 입력 검증을 우회하지 않음 |
| DB 조회 결과를 응답으로 변환 | 서비스에서 공개 필드를 선택해 응답 모델을 생성. ORM 객체 전체를 사전으로 풀어 전달하지 않음 |
| 라우터 응답 | 응답 모델을 선언하고 서비스가 만든 결과를 반환. 업무 로직이 없는 health는 기존처럼 라우터에서 응답 생성 |
| JSON 직렬화 | 아래 [별칭 적용 기준](#api-필드-별칭)을 따르고 내부 데이터 전달을 위해 불필요하게 JSON으로 변환하지 않음 |

스키마에서 ORM 모델을 import하거나 DB 조회를 수행하지 않습니다. 모델과 스키마는 서비스에서 조합하며, 이는 기존 아키텍처의 의존 방향을 따릅니다.
기본은 필드별 명시적 생성이며, ORM 속성 기반 자동 변환이 필요하면 실제 ORM 모델의 공개 필드·별칭·조회 범위를 검증한 뒤 적용합니다.
생성·검증 API 참고: [Pydantic 모델](https://docs.pydantic.dev/latest/concepts/models/).

### 검증 책임과 미정 정책

- 스키마에서는 타입·길이·형식과 입력값만으로 판단할 수 있는 조건을 검증하는 방식을 권장합니다. 검증 함수 안에서 DB·외부 API를 호출하지 않습니다.
- 저장된 데이터가 필요한 중복 확인·권한·상태 전이 등 업무 판단은 서비스가 담당합니다. DB 제약과 모든 저장 경로의 상태값 검증은 [DB 설계 가이드](database.md)를 함께 따릅니다.
- 요청에 정의되지 않은 필드의 거절·무시·허용, 타입 자동 변환 허용 범위는 검토안입니다. API 계약을 합의한 뒤 설정하며 Pydantic 기본 동작을 팀의 확정 정책으로 간주하지 않습니다.
- 필드 오류 경로·422 세부 변환은 첫 기능 개발 시 결정한다는 [오류 계약](../api/errors.md#입력-검증-오류)을 유지합니다.

구현 시 실제 JSON·쿼리·OpenAPI 이름의 일치, 요청에 노출할 필드와 응답 공개 필드, 유효하지 않은 입력 처리를 확인합니다. 순수 검증 로직과 실제 API 경계의 테스트 분류는 [테스트 가이드](testing.md#백엔드-테스트)를 따릅니다.

## API 필드 별칭

> 상태: [필드 네이밍 계약](../api/naming.md)의 구현 가이드. `ApiModel`과 JSON·쿼리 입력 경계 검증을 구현했습니다.

요청·응답·쿼리 모델과 그 중첩 모델은 [`ApiModel`](../../backend/app/schemas/base.py)을 상속해 공통 설정을 사용합니다.

| 설정 | 적용 목적 |
|---|---|
| `alias_generator=to_camel` | 선언된 Python 필드의 외부 이름 생성 |
| `validate_by_alias=True`, `validate_by_name=False` | 기본 검증에서 외부 별칭만 필드 입력으로 사용 |
| `serialize_by_alias=True` | `model_dump()`·`model_dump_json()`의 기본 출력에 외부 이름 사용 |
| `loc_by_alias=True` | HTTP 입력의 필드 오류 위치에 외부 이름 사용 |

HTTP JSON은 FastAPI의 요청 본문 모델로, 쿼리는 `Annotated[QueryModel, Query()]`로 연결해 기본 검증 경로를 사용합니다. 개별 쿼리 인자를 사용하면 `Query(alias="pageSize")`처럼 별칭을 지정합니다. 일반 함수 인자명은 모델 설정으로 자동 변환되지 않습니다. 응답은 `response_model`을 선언하고 FastAPI의 기본 별칭 직렬화를 사용합니다.

Python 내부 생성은 `from_internal()`을 사용합니다. 이 메서드는 Pydantic의 `model_validate(values, by_alias=False, by_name=True, extra="forbid")`를 호출해 내부 필드명으로 검증합니다. 일반 생성자나 기본 `model_validate()`는 HTTP와 같은 별칭 입력 경로이므로, 별칭과 다른 `snake_case` 키워드로 내부 모델을 만들 때 사용하지 않습니다. HTTP 요청 데이터를 `from_internal()`로 전달하거나 HTTP 모델의 `validate_by_name`을 켜면 입력 지원 범위가 달라집니다.

아래 모델·필드는 사용법 설명용이며 제품 API가 아닙니다.

```python
from app.schemas.base import ApiModel


class ExamplePayload(ApiModel):
    display_name: str


payload = ExamplePayload.from_internal(display_name="생일팀")
payload.model_dump()  # {"displayName": "생일팀"}
payload.model_dump(by_alias=False)  # {"display_name": "생일팀"}
ExamplePayload.model_validate({"displayName": "생일팀"})  # 외부 데이터 검증
```

내부 생성에서만 적용한 `extra="forbid"`는 선택 필드·중첩 입력의 키 오타가 조용히 무시되는 것을 막습니다. HTTP의 미등록 필드 처리 정책은 공통 모델에서 정하지 않으며, 해당 API 계약에 따라 개별 모델에 설정합니다. 타입 변환과 ORM 속성 검증도 전역 정책으로 추가하지 않습니다.

중첩 객체는 공통 모델을 상속한 별도 모델로 선언합니다. 임의 `dict`의 데이터 키·문자열 값을 재귀 변환하는 유틸은 사용하지 않습니다. 내부 전달용 사전이 필요하면 `model_dump(by_alias=False)`를 명시합니다.

[`test_schemas.py`](../../backend/tests/unit/test_schemas.py)는 내부 생성·검증·직렬화를, [`test_api_naming.py`](../../backend/tests/integration/test_api_naming.py)는 실제 JSON·쿼리, 선택·중첩 필드, 두 이름의 동시 입력, 응답·OpenAPI·오류 필드명을 검증합니다. HTTP 테스트용 라우트는 제품 앱에 등록하지 않습니다. `/health`는 `ApiModel`을 적용하면서 기존 계약을 유지합니다.

설정 참고: [Pydantic 별칭](https://docs.pydantic.dev/latest/concepts/alias/), [FastAPI 쿼리 모델](https://fastapi.tiangolo.com/tutorial/query-param-models/).

## 오류 처리 구현과 연동

> 상태: 공통 오류 계약의 구현 가이드. 오류 핸들러·응답 스키마는 아직 미구현입니다. 필드 오류 변환은 첫 기능 개발 시 경로 계약 합의 후 구현합니다.

공개 응답 형식과 검증 조건은 [공통 오류 계약](../api/errors.md)을 따릅니다. 이 절은 구현 위치와 프론트 연동 책임을 설명하며 계약 본문을 복사하지 않습니다.
레이어 간 허용 의존 방향은 [아키텍처](../architecture.md#의존-방향)를 기준으로 합니다.

| 위치 | 책임 |
|---|---|
| `core` | HTTP에 독립적인 업무 예외. 실제 업무 규칙이 생길 때 추가 |
| `schemas` | 공통 오류 응답 모델 |
| `api` | 업무 예외·입력 검증·HTTP 오류·예상하지 못한 예외를 HTTP 응답으로 변환 |
| `main.py` | 예외 핸들러를 앱에 등록 |
| 프론트 공통 API 클라이언트 | 실제 응답 검증·오류 정리, 네트워크 및 비JSON 응답의 기본 처리 |
| 프론트 화면 | 코드에 따른 동작, 필드 오류·일반 안내 표시 |

알 수 없는 코드·잘못된 본문·네트워크 실패도 공통 클라이언트에서 처리하며, 네트워크 실패에 서버가 보낸 것처럼 가짜 상태 코드를 붙이지 않습니다.
TypeScript 타입 선언만으로 수신 JSON이 검증되지는 않으므로 요청 경계에서 형태를 확인합니다.

구현 참고: [FastAPI 오류 처리](https://fastapi.tiangolo.com/tutorial/handling-errors/), [Fetch 응답 처리](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch).

## 동기·비동기 사용 기준

[아키텍처의 비동기 기본 방식](../architecture.md#동기비동기-실행-방식)을 구현할 때 아래를 확인합니다.

- 라우터와 입출력 서비스는 `async def`로 작성하고, 하위 클라이언트·DB 호출까지 비동기인지 확인합니다.
- `async def` 안에서 동기 HTTP·DB 호출이나 `time.sleep()`을 직접 실행하지 않습니다. 동기 작업이 끝날 때까지 같은 이벤트 루프의 다른 요청도 멈출 수 있습니다.
- FastAPI가 호출하는 일반 `def` 라우터·의존성은 스레드풀에서 실행됩니다. 반면 비동기 함수 안에서 직접 호출한 일반 서비스·유틸 함수는 같은 이벤트 루프 스레드에서 실행되며, 자동으로 스레드풀로 옮겨지지 않습니다.
- 동기 입출력이 불가피한 경우 동기 라우터를 사용하거나, 비동기 흐름과 만나는 지점에서 `run_in_threadpool()` 등으로 명시적으로 분리합니다. 이 경계를 문서·코드에 드러냅니다.
- 짧은 계산·Pydantic 검증은 동기로 실행합니다. 오래 걸리는 연산은 비동기로 선언하거나 스레드풀에 넣는 것만으로 병렬 성능이 보장되지 않으므로 별도 실행 방식을 검토합니다.
- 외부 호출에는 타임아웃을 두고 클라이언트·DB 연결을 적절히 종료합니다. `async`를 쓴다는 이유만으로 독립 작업을 무제한 병렬 실행하지 않습니다.

FastAPI의 [동기·비동기 함수 실행 안내](https://fastapi.tiangolo.com/async/#very-technical-details)를 기준으로 합니다.
테스트는 AnyIO의 pytest 플러그인과 HTTPX `AsyncClient`·`ASGITransport`를 사용합니다.
`backend/tests/conftest.py`에서 실행 백엔드를 `asyncio`로 지정합니다. Starlette TestClient를 거치지 않고 실제 ASGI 앱을 호출합니다.
현재 lifespan은 환경 설정·DB 연결을 검증하고 종료 시 연결 풀을 정리합니다. 테스트에서도 이를 실행하며, 외부 클라이언트를 도입하면 해당 자원 검증을 추가합니다.
이 방식은 [FastAPI 비동기 테스트 안내](https://fastapi.tiangolo.com/advanced/async-tests/)를 따릅니다.

## 버전과 의존성 관리

Python은 3.13 계열을 지원 범위로 정하고, 실제 개발 버전은 `backend/.python-version`에 고정합니다.
직접 의존성의 조건은 `backend/pyproject.toml`, 간접 의존성을 포함한 정확한 버전은 `backend/uv.lock`에서 관리합니다.
팀원은 잠금 파일을 사용해 설치하고, 의존성을 변경할 때만 의도적으로 갱신합니다.

아래 명령은 `backend/`에서 실행합니다.

```sh
# 실행에 필요한 패키지 추가
uv add <패키지명>

# 개발 도구 추가
uv add --dev <패키지명>

# 특정 패키지 업데이트
uv lock --upgrade-package <패키지명>
uv sync --locked
```

변경된 `pyproject.toml`과 `uv.lock`을 함께 검토하고 해당 변경이 만든 파일을 커밋합니다.
Python 버전을 바꾸면 `.python-version`과 지원 범위를 함께 확인합니다.
uv의 [의존성 관리](https://docs.astral.sh/uv/concepts/projects/dependencies/)와
[잠금·동기화](https://docs.astral.sh/uv/concepts/projects/sync/) 방식을 따릅니다.

## 검사 도구

Ruff는 Python 3.13 기준으로 기본 오류 검사와 import 정렬을 적용합니다.
`uv run --locked ruff check .`와 `uv run --locked ruff format --check .`로 검사합니다.
pytest 테스트는 [테스트·TDD 가이드](testing.md)에 따라 실제 기대 동작을 검증하도록 추가합니다.
앱·테스트를 대상으로 검사하며, 아래 CI에서도 동일한 도구를 실행합니다.

### 타입 검사

Pyrefly를 사용합니다. `tool.pyrefly`에 `preset = "default"`와 Python 3.13을 명시하고,
백엔드의 `.py`·`.pyi` 파일을 검사합니다. 가상환경과 캐시 등은 도구의 기본 제외 규칙을 따릅니다.
함수의 인자·반환값에는 타입을 적는 것을 권장합니다. 현재 설정은 모든 함수의 타입 표기를 강제하지 않습니다.
외부 라이브러리 문제는 해당 부분에서 확인하고, 전체 오류를 일괄 무시하지 않습니다.

`backend/`에서 `uv run --locked pyrefly check`를 실행합니다.
검사 대상이 없는 결과는 실제 코드의 타입 검사 통과로 기록하지 않습니다.
Pyrefly 버전은 `uv.lock`으로 고정하고, 에디터에서도 같은 버전과 프로젝트 설정을 사용합니다.

Pydantic v2 지원은 내장되어 있어 별도 플러그인이 필요하지 않습니다.
내부 모델 생성은 위 [별칭 구현 가이드](#api-필드-별칭)의 `from_internal()`을 사용합니다. 반환 타입은 호출한 모델로 유지되지만 `**values: object` 인자의 필드별 이름·타입은 Pyrefly가 정적으로 검사하지 못합니다. 실행 시 Pydantic이 필수 필드·타입·키 오타를 검증하므로 내부 생성 테스트를 함께 작성합니다.
일반 생성자의 정적 검사 결과만으로 런타임 별칭 입력 지원을 판단하지 않습니다. 실제 API 필드 규칙은 [네이밍 계약](../api/naming.md)으로 확인하고 JSON·쿼리·응답 변환은 API 테스트로 검증합니다.

옵션은 [Pyrefly 설정 안내](https://pyrefly.org/en/docs/configuration/),
별칭 등의 지원 범위는 [Pydantic 지원 안내](https://pyrefly.org/en/docs/pydantic/)를 참고합니다.

### CI

[Backend CI](../../.github/workflows/backend-ci.yml)는 `main` 대상 PR 생성·수정·재개와 `main` 반영 후 실행됩니다.
경로 필터 없이 모든 변경에 실행하므로 문서·프론트만 바뀐 PR도 `Backend checks` 결과를 받습니다.
현재 검사 시간이 짧아 별도 변경 감지나 통과용 job 없이 동일한 백엔드 검사를 실행합니다.
기본 브랜치에 워크플로우가 병합된 후 GitHub Actions 화면에서 수동 실행할 수도 있습니다.

Python은 `.python-version`, 패키지는 `uv.lock`, uv는 워크플로우에 고정한 0.11.30을 사용합니다.
Ubuntu에서 PostgreSQL 17 테스트 서비스를 준비하고 `TEST_DATABASE_URL`을 전달합니다. SQLite·PostgreSQL을 실제 연결하는 통합 검사를 같은 job에서 실행합니다. Python 설치 후 아래 검사를 순서대로 실행하며, 실패하면 후속 단계로 넘어가지 않습니다.

| 단계 | `backend/`에서 실행할 명령 |
|---|---|
| 의존성 설치 | `uv sync --locked` |
| 린트·import 정렬 | `uv run --locked ruff check .` |
| 포맷 | `uv run --locked ruff format --check .` |
| 타입 | `uv run --locked pyrefly check` |
| 테스트 | `uv run --locked pytest` |

실패한 단계의 명령을 로컬에서 실행해 원인을 확인합니다. 설치가 실패하면 Python 버전과 잠금 파일부터 확인합니다.
같은 브랜치에서 새 실행이 시작되면 이전 실행을 취소하고, 실행 시간은 10분으로 제한합니다.
CI는 읽기 권한으로 검사하며 자동 수정·커밋·배포는 하지 않습니다.
`main` 보호 설정은 GitHub Actions가 보고한 `Backend checks` 통과를 필수로 요구합니다.
체크 이름이나 실행 조건을 바꾸면 [브랜치 보호 설정](git-workflow.md#main-브랜치-보호)도 함께 확인합니다.
필수 검사에 영향을 주는 `[skip ci]` 등의 커밋 메시지는 사용하지 않습니다. 워크플로우가 생략되면 결과가 대기 상태에 남아 병합이 막힐 수 있습니다.
커버리지 기준·업무 모델별 DB 검증·배포 자동화는 해당 기능을 개발할 때 정합니다.

설치·설치 확인 명령은 [백엔드 README](../../backend/README.md), 코드 배치는 [아키텍처](../architecture.md)를 참고합니다.
