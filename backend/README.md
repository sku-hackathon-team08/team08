# 백엔드

Python 3.13과 FastAPI를 사용하며 uv로 가상환경·의존성을 관리합니다.
레이어 기반 모놀리식의 코드 배치와 DB 선택 상태는 [아키텍처](../docs/architecture.md)에서 확인합니다.

현재는 의존성 설정만 준비했습니다. 앱 진입점·기능 API·DB 연결·CI는 후속 작업입니다.

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

아직 앱·테스트 파일이 없으므로 서버 실행과 기능 테스트 명령은 후속 스캐폴딩에서 추가합니다.
`pytest`만 실행했을 때 테스트가 없다는 결과는 테스트 통과를 의미하지 않습니다.

패키지별 역할과 추가·갱신 방법은 [백엔드 개발 가이드](../docs/guides/backend.md)를 참고합니다.
작업 전 [문서 지도](../docs/index.md)에서 관련 기준 문서를 확인합니다.
