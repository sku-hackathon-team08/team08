# 🎂 Team 08. 저오늘생일입니다축하해주세요

서경대학교 해커톤을 위한 Team 08의 프로젝트 저장소입니다.

현재 서비스 주제·이름·기능 범위와 프론트 기술 스택은 미정입니다.
백엔드는 FastAPI·uv, 로컬 DB는 SQLite로 정했습니다. 배포 DB로 PostgreSQL을 검토하고 있으며,
선택별 상태는 [아키텍처](docs/architecture.md)에서 확인할 수 있습니다.

## 프로젝트 소개

서비스가 정해지면 이곳에 해결하려는 문제, 대상 사용자, 핵심 기능과 데모 링크를 정리합니다.
상세 요구사항과 설계는 [docs 문서 지도](docs/index.md)에서 관리합니다.

백엔드는 하나의 FastAPI 애플리케이션으로 구성하는 모놀리식 구조를 사용합니다.

## 저장소 구성

| 경로 | 역할 |
|---|---|
| [frontend/](frontend/) | 프론트엔드 코드 |
| [backend/](backend/) | 백엔드 코드 |
| [docs/](docs/index.md) | SDD·SOT·요구사항·기능 및 기술 명세 |
| [AGENTS.md](AGENTS.md) | 에이전트가 docs를 읽도록 안내 |
| [CLAUDE.md](CLAUDE.md) | Claude용 문서 진입점 |

## 개발 시작

현재 실행 가능한 앱과 설치·실행 명령은 없습니다.
초기 스캐폴딩을 구현한 뒤 각 파트 README에 실제 실행 방법을 추가합니다.

- [프론트엔드 안내](frontend/README.md)
- [백엔드 안내](backend/README.md)
- [기준 문서와 상태](docs/sot.md)
- [명세 기반 개발 흐름 검토안](docs/sdd.md)
