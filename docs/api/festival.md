# 축제 서비스 API 명세 v0.1

> 상태: **검토안·미구현** · 2026-09-10 · 기준: [PRD v1.2](../prd/index.md).
> 경로·필드·인증·오류·동시성 방식은 이번에 작성한 제안입니다. 제품 확정과 API 계약 확정을 구분합니다. 기존 [네이밍](naming.md)·[공통 오류](errors.md)의 확정 사항은 유지합니다.

## 문서 안내

- 처음 보는 경우: 아래 **API 목록**에서 필요한 기능을 선택합니다.
- 필드 의미 확인: [응답 모델 사전](festival/models.md)
- 인증·오류·재전송 확인: [공통 규칙](festival/common.md)
- 아직 결정하지 않은 내용: [검토 목록](festival/review.md)

## API 목록

### 행사·진입

| ID | 기능 | Method |
|---|---|---|
| E01 | [행사 신청](festival/event-entry.md#e01) | `POST` |
| E02 | [행사 신청 조회](festival/event-entry.md#e02) | `GET` |
| E03 | [세션 생성](festival/event-entry.md#e03) | `POST` |
| E04 | [내 세션 조회](festival/event-entry.md#e04) | `GET` |
| E05 | [행사 지도 조회](festival/event-entry.md#e05) | `GET` |

### 신고 입력

| ID | 기능 | Method |
|---|---|---|
| I01 | [신고 내용 분석](festival/intake.md#i01) | `POST` |
| I02 | [분석 결과 조회](festival/intake.md#i02) | `GET` |
| I03 | [스태프 신고 전송](festival/intake.md#i03) | `POST` |
| I04 | [관리자 직접 신고](festival/intake.md#i04) | `POST` |

### 조회·처리·지원

| ID | 기능 | Method |
|---|---|---|
| R01 | [내 신고 목록](festival/report-queries.md#r01) | `GET` |
| R02 | [내 신고 상세](festival/report-queries.md#r02) | `GET` |
| R03 | [관제 신고 목록](festival/report-queries.md#r03) | `GET` |
| R04 | [관제 신고 상세](festival/report-queries.md#r04) | `GET` |
| R05 | [지도 핀 목록](festival/report-queries.md#r05) | `GET` |
| R06 | [신고 처리 이력](festival/report-queries.md#r06) | `GET` |
| R07 | [담당 배정·분류 확정](festival/report-actions.md#r07) | `PATCH` |
| R08 | [유형·위험도 수정](festival/report-actions.md#r08) | `PATCH` |
| R09 | [신고 완료](festival/report-actions.md#r09) | `PATCH` |
| R10 | [담당 배정 취소](festival/report-actions.md#r10) | `PATCH` |
| R11 | [신고 취소](festival/report-actions.md#r11) | `PATCH` |
| R12 | [지원요청 시작](festival/support.md#r12) | `POST` |
| R13 | [지원요청 종료](festival/support.md#r13) | `PATCH` |
| R14 | [지원 참여 목록](festival/support.md#r14) | `GET` |
| R15 | [지원 참여](festival/support.md#r15) | `POST` |
| R16 | [본인 지원 참여 취소](festival/support.md#r16) | `PATCH` |

### 통계·내보내기

| ID | 기능 | Method |
|---|---|---|
| O01 | [관제 통계](festival/outputs.md#o01) | `GET` |
| O02 | [내 활동 리포트](festival/outputs.md#o02) | `GET` |
| O03 | [활동 리포트 PDF](festival/outputs.md#o03) | `GET` |
| O04 | [접근 경로 조회](festival/outputs.md#o04) | `GET` |

## 화면에서 API까지

1. 행사 신청 → 신청 조회 → 발급된 코드로 역할별 세션 생성 → 지도 조회.
2. 음성·텍스트 내용 확인 → 분석 생성/조회 → 최종 전송 → 신고 생성.
3. 관리자 목록·지도·상세 조회 → claim 한 번으로 담당 배정·분류 동시 확정.
4. 담당자가 지원요청 생성 → 다른 관리자 참여 → 본인 참여 취소/재참여 → 담당자가 요청 종료.
5. 담당자 완료 또는 담당 배정 취소, 같은 행사 관리자 누구나 사유와 함께 신고 취소.
6. 스태프 자신의 신고 내역 조회 → 활동 리포트·PDF(집계/생성 정책 결정 필요).

어떤 조회도 담당을 배정하지 않습니다. 구역·게이트 고객 편집, 긴급 롱프레스 즉시 접수, 신고 물리 삭제, 자동 위험도 승격 API는 정의하지 않습니다.

## 작성 범위

전체 29개 작업의 요청·응답·권한·실패 조건을 작성했습니다. 행사 신청·세션, 집계·PDF·경로는 미정 의존성을 명시했습니다. ERD·마이그레이션·외부 제공자 계약·앱 방식은 변경하지 않습니다. 아래에서 제시한 자원은 공개 API 표현이며 테이블과 일대일 대응할 필요가 없습니다.
