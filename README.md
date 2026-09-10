# 🎂 Team 08. 저오늘생일입니다축하해주세요

서경대학교 해커톤을 위한 Team 08의 프로젝트 저장소입니다.

서비스는 **현장의 지금**입니다. 축제 스태프의 음성·텍스트 신고를 3D 지도와 연결해 관리자의 담당 배정·지원·완료를 돕습니다.
[PRD v1.2](docs/prd/index.md)에 기획 결정을 반영했으며, 기능 API·ERD는 후속 작성 대상입니다.
백엔드는 Python 3.13·FastAPI·uv, 로컬 DB는 SQLite로 정했습니다. 배포 DB로 PostgreSQL을 검토하고 있으며,
선택별 상태는 [아키텍처](docs/architecture.md)에서 확인할 수 있습니다.

## 프로젝트 소개

스태프는 모바일 앱, 관리자는 태블릿 중심 관제 화면을 사용합니다. 제공자가 구역·게이트 데이터를 준비하고 행사 코드로 이용합니다. 앱 방식·지원 OS는 미정이며 기존 프론트는 Vite·React·TypeScript 기반의 초기 구성입니다.
상세 요구사항과 설계는 [docs 문서 지도](docs/index.md)에서 관리합니다.

백엔드는 레이어별로 코드를 나누고 하나의 FastAPI 애플리케이션으로 실행하는 레이어 기반 모놀리식 구조를 사용합니다.

## 저장소 구성

| 경로 | 역할 |
|---|---|
| [frontend/](frontend/) | 프론트엔드 코드 |
| [backend/](backend/) | 백엔드 코드 |
| [docs/](docs/index.md) | SDD·SOT·요구사항·기능 및 기술 명세 |
| [AGENTS.md](AGENTS.md) | 에이전트가 docs를 읽도록 안내 |
| [CLAUDE.md](CLAUDE.md) | Claude용 문서 진입점 |

## 개발 시작

백엔드 최소 앱과 상태 확인 API, 테스트·CI를 구성했습니다.
설치·서버 실행·검사 방법은 백엔드 README에서 확인합니다. SQLite·PostgreSQL 연결과 시작/종료 처리를 구성했습니다. 서비스 기능·업무 테이블은 아직 없습니다.

- [프론트엔드 안내](frontend/README.md)
- [백엔드 안내](backend/README.md)
- [기준 문서와 상태](docs/sot.md)
- [명세 기반 개발 흐름 검토안](docs/sdd.md)
