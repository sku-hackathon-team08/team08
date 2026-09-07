# 백엔드

Python 3.13과 FastAPI를 사용하며 uv로 가상환경·의존성을 관리합니다.
레이어 기반 모놀리식의 코드 배치와 DB 선택 상태는 [아키텍처](../docs/architecture.md)에서 확인합니다.

FastAPI 앱과 `/health`, 기본 테스트·CI를 구성했습니다. 서비스 API·DB 연결은 후속 작업입니다.
`app/main.py`는 앱 조립, `app/api/`는 라우터, `app/schemas/`는 데이터 계약을 담당합니다.
나머지 레이어는 패키지 경계만 준비했으며, [허용 의존 방향](../docs/architecture.md#의존-방향)에 따라 기능을 추가합니다.

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

## 서버 실행

`backend/`에서 실행합니다.

```sh
uv run --locked uvicorn app.main:app --reload
```

- 앱 확인: [GET /health](http://127.0.0.1:8000/health)
- Swagger UI: [API 호출 확인](http://127.0.0.1:8000/docs)
- OpenAPI: [현재 구현 스키마](http://127.0.0.1:8000/openapi.json)

`/health`는 `200 OK`와 `{"status": "ok"}`를 반환합니다. 현재 환경변수·DB·API 키 설정은 필요하지 않습니다.
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

테스트 범위를 골라 실행할 수도 있습니다. 아래 명령도 `backend/`에서 실행합니다.

```sh
uv run --locked pytest tests/unit
uv run --locked pytest tests/integration
uv run --locked pytest tests/integration/test_health.py
```

현재 유닛 테스트는 없으므로 `tests/unit`만 실행하면 `no tests ran`과 종료 코드 5가 나옵니다.
실제 로직의 테스트를 추가하기 전에는 전체 또는 통합 테스트 명령으로 검증합니다.
CI는 `pytest` 한 번으로 두 폴더를 모두 수집하며, 테스트가 없는 결과를 통과로 바꾸지 않습니다.
분류 기준·폴더 구조·작성 권고는 [백엔드 테스트 가이드](../docs/guides/testing.md#백엔드-테스트)를 참고합니다.
실행 조건과 실패 시 확인할 내용은 [백엔드 CI 안내](../docs/guides/backend.md#ci)를 참고합니다.

패키지별 역할과 추가·갱신 방법은 [백엔드 개발 가이드](../docs/guides/backend.md)를 참고합니다.
작업 전 [문서 지도](../docs/index.md)에서 관련 기준 문서를 확인합니다.
