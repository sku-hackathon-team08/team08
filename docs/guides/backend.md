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

## 기능 추가 순서

폴더 책임과 허용 import 방향은 [아키텍처](../architecture.md#의존-방향)를 기준으로 합니다.

1. `docs/api/`와 관련 기능 문서에 기대 동작을 정하고, `schemas/<기능>.py`에 데이터 계약을 작성합니다.
2. 업무 규칙은 `services/<기능>.py`에 둡니다. 저장이 필요하면 모델·연결 구성을 정하고 필요한 조회·저장 책임을 구현합니다.
3. `api/routes/<기능>.py`에서 HTTP 입력을 서비스에 전달하고 응답을 만듭니다.
4. `api/router.py`에 라우터를 등록하고, 실제 앱을 호출하는 테스트를 `tests/`에 추가합니다.
5. [의존 방향·순환 참조 규칙](../architecture.md#순환-참조를-막는-규칙)과 기존 검사 명령을 확인합니다.

업무 로직이 없는 상태 확인 API는 서비스·리포지토리 없이 라우터·스키마만 사용합니다.
아직 기능이 없는 패키지는 그대로 두고, 가짜 DB 연결·기본 CRUD·더미 서비스를 채우지 않습니다.

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
이는 호환성 확인용 패턴이며 실제 API의 필드 규칙은 API 구현 시 계약으로 정합니다.
`alias_generator`가 생성한 camelCase 이름을 Python 생성자 인자로 직접 사용하는 패턴은 별도로 확인해야 합니다.
정적 타입 검사와 실제 요청·응답 변환 검증은 구분하며 API 테스트를 함께 작성합니다.

옵션은 [Pyrefly 설정 안내](https://pyrefly.org/en/docs/configuration/),
별칭 등의 지원 범위는 [Pydantic 지원 안내](https://pyrefly.org/en/docs/pydantic/)를 참고합니다.

### CI

[Backend CI](../../.github/workflows/backend-ci.yml)는 `main` 대상 PR 생성·수정·재개와 `main` 반영 후 실행됩니다.
자동 실행 대상 경로는 `backend/**`와 `.github/workflows/backend-ci.yml`입니다. 문서만 변경하면 자동 실행하지 않습니다.
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
검사 실패의 병합 차단을 강제하는 브랜치 보호·필수 상태 검사 설정은 별도입니다.
경로 조건으로 실행이 생략될 수 있으므로 필수 상태 검사로 지정할 때 이 조건도 함께 검토합니다.
커버리지 기준·DB 통합 검사·배포 자동화는 해당 기능을 개발할 때 정합니다.

설치·설치 확인 명령은 [백엔드 README](../../backend/README.md), 코드 배치는 [아키텍처](../architecture.md)를 참고합니다.
