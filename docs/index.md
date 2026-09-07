# 문서 지도

프로젝트의 SDD·SOT·요구사항·설계를 관리하는 시작점입니다.
프로젝트 소개는 [루트 README](../README.md), 코드는 `frontend/`와 `backend/`에 둡니다.

## 먼저 읽을 문서

1. [SOT — 기준 문서](sot.md): 주제별 기준 문서의 위치·책임·상태
2. [SDD — 명세 기반 개발](sdd.md): 명세를 구현·검증과 연결하는 작업 흐름 검토안
3. 작업 대상의 요구사항·기능·기술 명세

## 문서 구조

```text
docs/
├── index.md           # 문서 지도
├── sot.md             # 기준 문서의 위치·책임·유지 방법
├── sdd.md             # 명세 기반 개발 흐름 검토안
├── prd/               # 주제별 제품 요구사항
│   ├── index.md       # PRD 목차
│   ├── context.md     # 문제·사용자·목표
│   ├── scope.md       # MVP 범위·우선순위
│   └── success-criteria.md # 성공 기준·데모 흐름
├── architecture.md    # 시스템 구성과 코드 역할을 기록할 틀
├── features/
│   └── index.md       # 기능 명세 목록
├── api/
│   ├── index.md       # API 계약 목록·관리 원칙
│   ├── errors.md      # 공통 오류 계약·구현 완료 기준
│   ├── naming.md      # JSON·쿼리 필드 네이밍 계약
│   ├── integration-contracts.md # 프론트·백엔드 계약 검토
│   └── health.md      # 앱 상태 확인 계약
├── specs/
│   └── index.md       # 데이터·연동 등 기술 명세 목록
├── guides/
│   ├── index.md       # 가이드 목차
│   ├── development.md # 개발 컨벤션
│   ├── comments.md    # 주석·docstring 권고사항
│   ├── backend.md     # 백엔드 의존성·개발 환경
│   ├── git-workflow.md # 브랜치·커밋·PR
│   └── testing.md     # 테스트·TDD
└── decisions.md       # 결정 기록
```

## 작업별 시작점

| 작업 | 읽거나 갱신할 문서 |
|---|---|
| 서비스·기능 범위 정하기 | [PRD](prd/index.md) → [기능 명세](features/index.md) |
| 프론트·백엔드 구현 | 해당 기능 명세 → [API 계약](api/index.md)·[기술 명세](specs/index.md) → [아키텍처](architecture.md) |
| 스택·공통 설계 결정 | [결정 기록](decisions.md) → 아키텍처·관련 기술 명세 |
| 작업 관리·PR 작성 | [GitHub Issues](https://github.com/sku-hackathon-team08/team08/issues) → [Git 가이드](guides/git-workflow.md) → [이슈 템플릿](../.github/ISSUE_TEMPLATE/task.md) · [PR 템플릿](../.github/pull_request_template.md) |
| 문서·에이전트 안내 변경 | SOT → 문서 지도 → 루트 에이전트 안내 |

## 개발 가이드

[가이드 목차](guides/index.md)에서 필수 규칙 제안과 권장사항의 구분을 확인합니다.
구현은 [개발 컨벤션](guides/development.md), 커밋·PR은 [Git 협업](guides/git-workflow.md),
검증과 TDD는 [테스트 가이드](guides/testing.md)를 참고합니다.

## 현재 상태

백엔드는 Python 3.13·FastAPI·uv, 로컬 DB는 SQLite로 정했습니다. 배포용 PostgreSQL은 후보이며 [아키텍처](architecture.md)에 상태를 기록합니다.
앱 상태 확인 API와 백엔드 CI는 구현했습니다. 공통 오류 응답의 기본 형식과 API 필드 네이밍은 합의했으며 핸들러·공통 스키마·별칭 설정은 미구현입니다. 서비스·프론트 스택·기능 API·데이터 모델은 미정입니다. 빈 문서의 항목은 작성 틀이며 확정된 요구사항이 아닙니다.
SDD의 세부 절차도 검토안이며, 문서 구조를 만드는 것만으로 명세 승인이나 구현 완료를 의미하지 않습니다.
필요한 문서가 생기면 해당 목록에 연결합니다. 세부 유지 방법은 [SOT](sot.md)를 따릅니다.
