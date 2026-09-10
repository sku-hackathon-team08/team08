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
│   ├── success-criteria.md # 성공 기준·데모 흐름
│   ├── spec-review.md # 확정 결정·미정 목록
│   └── sources/      # 원본 보존 자료·index.md
├── architecture.md    # 시스템 구성·레이어 역할·의존 방향
├── features/
│   ├── index.md       # 기능 명세 목록
│   ├── event-entry.md # 행사 진입
│   ├── report-intake.md # 신고 입력
│   ├── report-lifecycle.md # 담당·취소·지원
│   ├── command-dashboard.md # 관제·미확인
│   └── activity-report.md # 내역·리포트
├── api/
│   ├── index.md       # API 계약 목록·관리 원칙
│   ├── errors.md      # 공통 오류 형식·코드·구현 범위·OpenAPI·완료 기준
│   ├── naming.md      # JSON·쿼리 필드 네이밍·외부 입력 지원 범위
│   ├── integration-contracts.md # 프론트·백엔드 계약 검토
│   ├── festival.md    # 축제 API v0.1 검토안 목차
│   ├── festival/      # index·common·event-entry·intake·reports·outputs·review
│   └── health.md      # 앱 상태 확인 계약
├── db/
│   └── index.md       # DB 모델·ERD·저장 제약 명세 목록
├── integrations/
│   └── index.md       # 외부 제공자 연동 명세 목록
├── guides/
│   ├── index.md       # 가이드 목차
│   ├── development.md # 개발 컨벤션
│   ├── comments.md    # 주석·docstring 권고사항
│   ├── backend.md     # 백엔드 설정·로깅·DB·스키마·API 변환·오류 처리·검사·CI
│   ├── database.md    # DB 설계·네이밍의 확정 선택·권고·미정 항목
│   ├── git-workflow.md # 브랜치·커밋·PR
│   └── testing.md     # 테스트·TDD
└── decisions.md       # 결정 기록
```

## 작업별 시작점

| 작업 | 읽거나 갱신할 문서 |
|---|---|
| 서비스·기능 범위 정하기 | [PRD](prd/index.md) → [기능 명세](features/index.md) |
| 프론트·백엔드 구현 | [기능 명세](features/index.md) → 필요한 [API](api/index.md)·[DB](db/index.md)·[외부 연동](integrations/index.md) 명세 → [아키텍처](architecture.md) |
| DB 모델·관계 설계 | [DB 설계 가이드](guides/database.md) → [DB 명세](db/index.md) |
| 스택·공통 설계 결정 | [결정 기록](decisions.md) → 아키텍처·관련 기술 명세 |
| 작업 관리·PR 작성 | [GitHub Issues](https://github.com/sku-hackathon-team08/team08/issues) → [Git 가이드](guides/git-workflow.md) → [이슈 템플릿](../.github/ISSUE_TEMPLATE/task.md) · [PR 템플릿](../.github/pull_request_template.md) |
| 문서·에이전트 안내 변경 | SOT → 문서 지도 → 루트 에이전트 안내 |

## 개발 가이드

[가이드 목차](guides/index.md)에서 필수 규칙 제안과 권장사항의 구분을 확인합니다.
구현은 [개발 컨벤션](guides/development.md), 커밋·PR은 [Git 협업](guides/git-workflow.md),
검증과 TDD는 [테스트 가이드](guides/testing.md)를 참고합니다.

## 현재 상태

백엔드는 Python 3.13·FastAPI·uv, 로컬 DB는 SQLite로 정했습니다. 배포용 PostgreSQL은 후보이며 [아키텍처](architecture.md)에 상태를 기록합니다.
앱 상태 확인 API·백엔드 CI·환경 설정과 기본 DB URL 선택은 구현했습니다. 기본 로깅과 SQLite·PostgreSQL 연결·시작/종료 처리를 구현했고 업무 모델·마이그레이션은 후속 작업입니다. 공통 오류 응답의 기본 형식·코드 5개는 합의했으며 400·404·405·500의 핸들러·스키마·OpenAPI 연결을 구현했습니다. 422는 FastAPI 기본 응답을 유지하고 공통 형식·필드 오류 변환은 후속 작업입니다. API 필드 네이밍의 공통 스키마·별칭과 HTTP·내부 생성의 입력 경계는 구현했습니다. 프론트는 Vite·React·TypeScript 기반 초기 구성을 완료했으며 상세 스택은 [아키텍처](architecture.md#프론트-환경)에 기록합니다. 서비스는 현장의 지금으로 정했으며 [PRD v1.2](prd/index.md)에 인터뷰·최종 화면 흐름의 기획 결정을 반영했습니다. 스태프는 앱으로 개발하며 방식·OS는 미정입니다. [기능 API v0.1](api/festival.md)은 검토안으로 작성했으며 미구현입니다. 업무 데이터 모델은 후속 작성 대상입니다. 기획 명세의 미정 항목과 기술 문서의 작성 틀은 확정 요구사항이 아닙니다.
SDD의 세부 절차도 검토안이며, 문서 구조를 만드는 것만으로 명세 승인이나 구현 완료를 의미하지 않습니다.
문서를 변경할 때는 [SOT의 인덱스 갱신 기준](sot.md#인덱스-갱신-기준)에 따라 관련 목록·설명·링크를 함께 확인합니다.
