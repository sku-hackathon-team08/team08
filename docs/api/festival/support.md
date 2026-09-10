# 지원 요청·참여 API

> 검토안·미구현. 기준: [처리 권한](../../features/report-lifecycle.md), [관제](../../features/command-dashboard.md). 모델·오류·경합 우선순위는 [공통 규칙](common.md).

## 지원 요청

요청과 참여에 각각 ID를 부여합니다. 새 요청은 새 ID, 본인 취소 후 재참여도 새 참여 ID입니다. 과거 참여를 다시 활성화하지 않는 API 제안으로 지연된 취소가 새 참여를 끝내지 못하게 합니다.

## 바로 찾기

- [R12 · 지원요청 시작](#r12)
- [R13 · 지원요청 종료](#r13)
- [R14 · 지원 참여 목록](#r14)
- [R15 · 지원 참여](#r15)
- [R16 · 본인 지원 참여 취소](#r16)

<a id="r12"></a>

## R12 · 지원요청 시작

```http
POST /api/v1/admin/reports/{reportId}/support-requests
```

### 권한·요청

expectedVersion, IN_PROGRESS 담당자·현재 활성 요청 없음

### 성공 응답

201 `{supportRequest:SupportRequest,reportVersion:integer}`

### 오류

지원 공통 오류: 401 / 403 / 404 / 422 / 409. 상세 조건은 아래 공통 처리 규칙을 따릅니다.

<a id="r13"></a>

## R13 · 지원요청 종료

```http
PATCH /api/v1/admin/reports/{reportId}/support-requests/{requestId}/close
```

### 권한·요청

expectedVersion, 현재 담당자·해당 활성 요청

### 성공 응답

200 `{supportRequest:SupportRequest,reportVersion:integer}`

### 오류

지원 공통 오류: 401 / 403 / 404 / 422 / 409. 상세 조건은 아래 공통 처리 규칙을 따릅니다.

<a id="r14"></a>

## R14 · 지원 참여 목록

```http
GET /api/v1/admin/reports/{reportId}/support-requests/{requestId}/participants
```

### 권한·요청

같은 행사 ADMIN, cursor?,pageSize?

### 성공 응답

Page<Participation>

### 오류

지원 공통 오류: 401 / 403 / 404 / 422 / 409. 상세 조건은 아래 공통 처리 규칙을 따릅니다.

<a id="r15"></a>

## R15 · 지원 참여

```http
POST /api/v1/admin/reports/{reportId}/support-requests/{requestId}/participants
```

### 권한·요청

expectedVersion, 같은 행사 타 관리자·활성 요청

### 성공 응답

201 `{participation:Participation,reportVersion:integer}`

### 오류

지원 공통 오류: 401 / 403 / 404 / 422 / 409. 상세 조건은 아래 공통 처리 규칙을 따릅니다.

<a id="r16"></a>

## R16 · 본인 지원 참여 취소

```http
PATCH /api/v1/admin/reports/{reportId}/support-requests/{requestId}/participants/{participationId}/cancel
```

### 권한·요청

expectedVersion, 참여 본인·해당 참여 활성

### 성공 응답

200 `{participation:Participation,reportVersion:integer}`

### 오류

지원 공통 오류: 401 / 403 / 404 / 422 / 409. 상세 조건은 아래 공통 처리 규칙을 따릅니다.

## 공통 처리 규칙

- R12는 최초 참여자 0명으로 시작합니다. 이미 활성 요청이면 새 요청을 만들지 않고 409 INVALID_REPORT_STATE 제안입니다.
- R13은 closeReason=MANUAL·closedAt을 기록하고 활성 참여 전부를 REQUEST_CLOSED로 종료합니다. report 상태와 담당은 유지합니다. 이후 R12는 새 요청을 만듭니다.
- R14는 해당 요청의 종료 참여도 반환하는 제안입니다. 활성 여부는 endedAt=null로 판단합니다. 과거 요청 ID는 로그 changes의 supportRequestId로 찾을 수 있습니다.
- R15의 행위자는 세션에서 가져옵니다. 담당자의 자기 지원과 이미 활성인 본인의 중복 참여는 409 INVALID_REPORT_STATE 제안입니다. 다른 사람 참여를 추가하는 adminId 입력은 받지 않습니다. 인원 수 제한이나 FULL 오류는 없습니다.
- R16은 SELF_CANCELLED·endedAt을 기록하고 다른 참여·신고 담당·지원요청은 유지합니다. 재참여는 R15에서 새 participationId로 시작합니다. 다른 사람 참여 취소는 403, 이미 끝난 참여를 새 키로 취소하면 409입니다.
- 동일 Idempotency-Key 재시도는 원래 201/200을 복구합니다. 새 요청이 열린 후 이전 requestId/participationId로 온 변경은 새 요청·참여를 변경하지 않습니다.
- 모든 경로 ID의 부모 reportId/requestId 일치를 검사합니다. 불일치는 404입니다. 성공·실패 모두 원래 담당자·claimedAt을 지원자로 바꾸지 않습니다.
- 오류는 공통 401/403/404/422/409입니다. reportVersion은 report.version과 같은 값입니다.

## 지원과 담당 해제·종결 — 조건부 보완안

TBD-07에 대해 release/resolve/cancel 시 활성 요청을 함께 닫고 해당 참여를 종료하는 방안을 제안합니다. closeReason은 각각 REPORT_RELEASED / REPORT_RESOLVED / REPORT_CANCELLED이며 참여 endReason은 REQUEST_CLOSED입니다. 신고 변경·요청 종료·참여 종료·이력은 함께 반영합니다.

이는 사용자가 확정한 ‘담당자의 수동 지원요청 종료’와 별개인 **미확정 제안**입니다. 이 정책이 채택되기 전에는 관련 동작의 전체 계약을 구현 승인으로 해석하지 않습니다. 어떤 경우에도 종결 뒤 새 지원을 생성하거나 과거 요청이 새 참여를 수정해서는 안 됩니다.

