# 백엔드 개발

> 상태: 최소 앱·상태 확인 API·테스트·CI를 구성했습니다. 서비스 API·DB 구현은 후속 작업입니다.

## 현재 의존성

| 구분 | 패키지 | 역할 |
|---|---|---|
| 실행 | FastAPI | API 애플리케이션 프레임워크 |
| 실행 | Pydantic | 요청·응답 데이터 모델과 입력 검증 |
| 실행 | Uvicorn | FastAPI 앱을 실행하는 서버 |
| 개발 | pytest | 테스트 실행 |
| 개발 | HTTPX | AsyncClient·ASGITransport로 앱을 호출하는 테스트 클라이언트 |
| 개발 | AnyIO | pytest에서 asyncio 기반 비동기 테스트 실행 |
| 개발 | Ruff | 코드 포맷·오류·import 정렬 검사 |
| 개발 | Pyrefly | 함수 인자·반환값·변수의 타입 일치 검사 |

실행 패키지는 `backend/pyproject.toml`의 `project.dependencies`, 개발 도구는 `dependency-groups.dev`로 구분합니다.
배포할 웹 애플리케이션이므로 현재는 Python 배포 패키지를 만드는 빌드 설정을 추가하지 않습니다.
FastAPI와 Uvicorn은 필요한 기본 패키지만 설치합니다. 추가 기능은 사용 시점에 의존성을 보완합니다.
DB 접근 도구·LangGraph·인증 라이브러리는 기능을 구현할 때 선택합니다.
데이터 모델 설계는 [DB 설계 가이드](database.md)의 확정 선택·권장사항을 따르고 실제 구조는 [DB 명세](../db/index.md)에 기록합니다.

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

> 적용: 작성 패턴은 권고사항입니다. 이미 확정한 [API 네이밍](../api/naming.md)과 [레이어 의존 방향](../architecture.md#의존-방향)은 해당 기준을 따릅니다. 공통 기반 모델 구현은 후속 작업입니다.

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
- API용 공통 기반 모델은 `schemas/base.py`에 별칭 등 합의한 설정을 모으는 형태를 권장합니다. `id`·생성 시각·업무 필드를 모든 모델에 강제로 넣지 않습니다. 클래스 이름은 구현 시 정합니다.
- 같은 의미·검증 조건의 필드 묶음이 반복될 때만 공통 모델이나 중첩 모델을 고려합니다. 응답 모델이 생성 요청을 그대로 상속하는 등 서로 다른 목적을 중복 제거만을 위해 결합하지 않습니다.
- PATCH의 생략·null 의미는 해당 API를 설계할 때 정합니다. 생성 모델의 필드를 일괄 선택값으로 바꾸는 자동 생성 패턴은 기본으로 도입하지 않습니다.

### 생성과 변환 책임

| 상황 | 권장 패턴 |
|---|---|
| Python 코드에서 모델 생성 | `snake_case` 키워드 인자로 필요한 값을 명시 |
| 사전 등 외부 데이터를 모델로 변환 | 입력 경계에서 `model_validate()` 등 검증 경로 사용. `model_construct()`로 입력 검증을 우회하지 않음 |
| DB 조회 결과를 응답으로 변환 | 서비스에서 공개 필드를 선택해 응답 모델을 생성. ORM 객체 전체를 사전으로 풀어 전달하지 않음 |
| 라우터 응답 | 응답 모델을 선언하고 서비스가 만든 결과를 반환. 업무 로직이 없는 health는 기존처럼 라우터에서 응답 생성 |
| JSON 직렬화 | 아래 [별칭 적용 기준](#api-필드-별칭)을 따르고 내부 데이터 전달을 위해 불필요하게 JSON으로 변환하지 않음 |

스키마에서 ORM 모델을 import하거나 DB 조회를 수행하지 않습니다. 모델과 스키마는 서비스에서 조합하며, 이는 기존 아키텍처의 의존 방향을 따릅니다.
기본은 필드별 명시적 생성이며, ORM 속성 기반 자동 변환이 필요하면 ORM 선정 후 공개 필드·별칭·조회 범위를 검증한 뒤 적용합니다.
생성·검증 API 참고: [Pydantic 모델](https://docs.pydantic.dev/latest/concepts/models/).

### 검증 책임과 미정 정책

- 스키마에서는 타입·길이·형식과 입력값만으로 판단할 수 있는 조건을 검증하는 방식을 권장합니다. 검증 함수 안에서 DB·외부 API를 호출하지 않습니다.
- 저장된 데이터가 필요한 중복 확인·권한·상태 전이 등 업무 판단은 서비스가 담당합니다. DB 제약과 모든 저장 경로의 상태값 검증은 [DB 설계 가이드](database.md)를 함께 따릅니다.
- 요청에 정의되지 않은 필드의 거절·무시·허용, 타입 자동 변환 허용 범위는 검토안입니다. API 계약을 합의한 뒤 설정하며 Pydantic 기본 동작을 팀의 확정 정책으로 간주하지 않습니다.
- 필드 오류 경로·422 세부 변환은 첫 기능 개발 시 결정한다는 [오류 계약](../api/errors.md#입력-검증-오류)을 유지합니다.

구현 시 실제 JSON·쿼리·OpenAPI 이름의 일치, 요청에 노출할 필드와 응답 공개 필드, 유효하지 않은 입력 처리를 확인합니다. 순수 검증 로직과 실제 API 경계의 테스트 분류는 [테스트 가이드](testing.md#백엔드-테스트)를 따릅니다.

## API 필드 별칭

> 상태: [필드 네이밍 계약](../api/naming.md)의 구현 가이드. 공통 별칭 설정은 후속 구현입니다.

- 요청·응답 모델에 Pydantic의 `alias_generator=to_camel`을 적용합니다. Python 내부 이름으로 모델을 생성할 수 있게 입력 설정을 구성하고, 응답 직렬화에서 별칭이 사용되는지 확인합니다.
- 모델을 직접 사전으로 변환할 때는 `model_dump(by_alias=True)` 또는 대응하는 직렬화 설정을 사용합니다. 별칭 생성만으로 모든 반환 경로의 출력 이름이 바뀐다고 가정하지 않습니다.
- 쿼리는 별칭을 적용한 Pydantic 쿼리 모델이나 개별 `Query(alias="pageSize")`로 연결합니다. 일반 함수 인자명은 Pydantic 모델의 설정으로 자동 변환되지 않습니다.
- 중첩 모델에도 별칭 설정을 적용합니다. 임의의 `dict` 키를 재귀적으로 변환하는 유틸은 사용하지 않습니다.
- 실제 JSON·쿼리 입력, 응답 JSON, OpenAPI, 필드 오류의 이름을 통합 테스트로 확인합니다. 타입 검사 통과와 실제 변환 검증은 구분합니다.

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
현재 앱에는 시작·종료 자원 처리가 없습니다. 추후 lifespan으로 자원을 관리하면 테스트에서도 그 시작·종료 과정을 실행하도록 보완합니다.
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
Python 내부에서는 snake_case 필드명으로 모델을 생성하고, JSON 입출력에서 camelCase 별칭을 사용하는 방식을 검증했습니다.
실제 API의 필드 규칙은 [네이밍 계약](../api/naming.md)으로 확정했습니다. 공통 변환 구현·검증은 위 [별칭 구현 가이드](#api-필드-별칭)를 따릅니다.
`alias_generator`가 생성한 camelCase 이름을 Python 생성자 인자로 직접 사용하는 패턴은 별도로 확인해야 합니다.
정적 타입 검사와 실제 요청·응답 변환 검증은 구분하며 API 테스트를 함께 작성합니다.

옵션은 [Pyrefly 설정 안내](https://pyrefly.org/en/docs/configuration/),
별칭 등의 지원 범위는 [Pydantic 지원 안내](https://pyrefly.org/en/docs/pydantic/)를 참고합니다.

### CI

[Backend CI](../../.github/workflows/backend-ci.yml)는 `main` 대상 PR 생성·수정·재개와 `main` 반영 후 실행됩니다.
경로 필터 없이 모든 변경에 실행하므로 문서·프론트만 바뀐 PR도 `Backend checks` 결과를 받습니다.
현재 검사 시간이 짧아 별도 변경 감지나 통과용 job 없이 동일한 백엔드 검사를 실행합니다.
기본 브랜치에 워크플로우가 병합된 후 GitHub Actions 화면에서 수동 실행할 수도 있습니다.

Python은 `.python-version`, 패키지는 `uv.lock`, uv는 워크플로우에 고정한 0.11.30을 사용합니다.
Ubuntu에서 Python 설치 후 아래 검사를 순서대로 실행하며, 실패하면 후속 단계로 넘어가지 않습니다.

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
커버리지 기준·DB 통합 검사·배포 자동화는 해당 기능을 개발할 때 정합니다.

설치·설치 확인 명령은 [백엔드 README](../../backend/README.md), 코드 배치는 [아키텍처](../architecture.md)를 참고합니다.
