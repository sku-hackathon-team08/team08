# 신고 조회·담당·취소·지원 API

> 검토안·미구현. 기준: [처리 권한](../../features/report-lifecycle.md), [관제](../../features/command-dashboard.md). 모델·오류·경합 우선순위는 [공통 규칙](common.md).

## 조회

| ID / 경로 | 권한·쿼리 | 200 응답 |
|---|---|---|
| R01 GET /staff/reports | STAFF 본인, cursor?,pageSize? | Page<StaffReport> |
| R02 GET /staff/reports/{reportId} | STAFF 본인 | StaffReport |
| R03 GET /admin/reports | ADMIN 같은 행사, sort?=recent 또는 urgency, types?,statuses?,cursor?,pageSize? | Page<ReportCard> |
| R04 GET /admin/reports/{reportId} | ADMIN 같은 행사 | ReportDetail |
| R05 GET /admin/map-reports | ADMIN 같은 행사, types?,statuses?,cursor?,pageSize? | Page<MapPin> |
| R06 GET /admin/reports/{reportId}/logs | ADMIN 같은 행사, cursor?,pageSize? | Page<Log> |

Page는 공통 `{items,nextCursor,asOf}`입니다. MapPin은 `id,version,position,status,type,urgency,isUnacknowledged`를 ReportCard에서 선택한 모델입니다. 공통 목록 기본 크기를 쓰되 지도는 다음 커서를 끝까지 조회합니다. 첫 페이지를 전체 핀처럼 표시하지 않으며 로딩/부분 수신 상태를 구분합니다. 전체 규모·클러스터링은 A-06 미정입니다.

types·statuses는 쉼표로 구분한 enum 목록, 미지정 시 허용값 전체 제안입니다. 빈 문자열·알 수 없는 값은 422입니다. R03/R05는 CANCELLED를 제외하고, 명시적 CANCELLED 필터는 422 제안입니다. R01/R02와 권한 있는 R04/R06에서는 취소 기록을 유지합니다.

정렬 제안: 먼저 미확인 우선, recent는 createdAt 내림차순·id 내림차순, urgency는 URGENT→CAUTION→NORMAL·createdAt 내림차순·id 내림차순. 필터가 먼저 대상을 제한하고 그 안에서 미확인 상단을 적용하는 안은 **TBD-05 의존 검토안**입니다. R01은 createdAt·id 내림차순, R06은 occurredAt·id 오름차순입니다.

isUnacknowledged는 RECEIVED이며 최초 createdAt부터 긴급 3분·주의 10분·일반 30분을 초과했을 때 true입니다. 버전과 별개로 서버 조회 시각에 계산합니다. release로 접수 복귀해도 createdAt은 유지합니다. 분류 변경 후 임계 기준은 TBD-05이며 기존 값으로 계산하는 구현을 임의 확정하지 않습니다.

Log.action 제안: REPORT_CREATED, REPORT_CLAIMED, CLASSIFICATION_CHANGED, ASSIGNMENT_RELEASED, REPORT_RESOLVED, REPORT_CANCELLED, SUPPORT_REQUEST_OPENED, SUPPORT_REQUEST_CLOSED, SUPPORT_JOINED, SUPPORT_LEFT. 변경 내역은 허용된 공개 필드만 넣고 내부 토큰·DB 컬럼을 포함하지 않습니다.

조회 오류: 공통 401/403/404, 쿼리 검증 422. 실시간 갱신은 조회 기반 시작안이며 WebSocket·SSE 계약을 확정하지 않습니다.

## 처리 액션

모든 작업은 ADMIN 같은 행사, Idempotency-Key 및 expectedVersion이 필요합니다. 성공은 **200 ReportDetail**이며 변경 후 version을 반환합니다. 업무 변경과 이력은 함께 기록합니다. 성공 재전송은 최초 결과를 돌려줍니다. 새 키로 같은 종결 동작을 반복하면 409 INVALID_REPORT_STATE입니다.

| ID / PATCH 경로 | 요청 body | 조건·변경 |
|---|---|---|
| R07 /admin/reports/{reportId}/claim | expectedVersion, type:ReportType, urgency:Urgency | RECEIVED. 담당·IN_PROGRESS·유형/위험도 ADMIN_CONFIRMED를 함께 저장 |
| R08 /admin/reports/{reportId}/classification | expectedVersion, type?:ReportType, urgency?:Urgency | IN_PROGRESS 현재 담당자, type/urgency 최소 하나, null 불가 |
| R09 /admin/reports/{reportId}/resolve | expectedVersion, resolveNote?:string 또는 null | IN_PROGRESS 현재 담당자, RESOLVED·resolvedAt 기록. 메모 생략/null/공백은 null 제안 |
| R10 /admin/reports/{reportId}/release | expectedVersion | IN_PROGRESS 현재 담당자, RECEIVED·현재 담당/claimedAt 해제, createdAt·과거 이력 유지 |
| R11 /admin/reports/{reportId}/cancel | expectedVersion, cancelReason:string | RECEIVED 또는 IN_PROGRESS, 같은 행사 관리자 누구나, 필수 사유·cancelledBy·cancelledAt 기록 |

R07은 값을 수정하지 않아도 두 분류를 관리자 확인으로 남깁니다. R08은 보낸 필드만 관리자 확인 정보로 갱신하고 생략한 필드는 유지합니다. 동시에 claim이 경합하면 한 명만 배정·분류 저장에 성공하며 다른 요청은 409로 최신 조회를 안내합니다. 별도 분류 저장을 먼저 호출하지 않습니다.

R10에서 note를 받지 않는 것은 사유 정책 미정(TBD-07)에 대한 최소 계약 제안입니다. 사유 입력을 채택하면 선택/필수를 별도로 정의합니다. R11은 목록 X·상세 취소가 동일 API를 사용하며 DELETE/hide API는 없습니다. 완료·취소 시 기존 담당은 이력 식별을 위해 유지하는 제안입니다.

오류: 401/403/404/422 및 STALE_VERSION·INVALID_REPORT_STATE·공통 멱등성 오류. 다른 담당자의 완료/분류/해제는 403입니다. 신고가 종결된 경우 새 변경은 409입니다. 권한을 얻지 못한 클라이언트가 ‘지원 참여자’라는 이유로 담당 작업을 수행할 수 없습니다.

```json
{"expectedVersion":1,"type":"CROWD","urgency":"URGENT"}
```

```json
{"expectedVersion":4,"cancelReason":"동일 상황의 중복 신고로 확인했습니다."}
```

## 지원 요청

요청과 참여에 각각 ID를 부여합니다. 새 요청은 새 ID, 본인 취소 후 재참여도 새 참여 ID입니다. 과거 참여를 다시 활성화하지 않는 API 제안으로 지연된 취소가 새 참여를 끝내지 못하게 합니다.

| ID / 경로 | body·권한 | 성공 |
|---|---|---|
| R12 POST /admin/reports/{reportId}/support-requests | expectedVersion, IN_PROGRESS 담당자·현재 활성 요청 없음 | 201 `{supportRequest:SupportRequest,reportVersion:integer}` |
| R13 PATCH /admin/reports/{reportId}/support-requests/{requestId}/close | expectedVersion, 현재 담당자·해당 활성 요청 | 200 `{supportRequest:SupportRequest,reportVersion:integer}` |
| R14 GET /admin/reports/{reportId}/support-requests/{requestId}/participants | 같은 행사 ADMIN, cursor?,pageSize? | Page<Participation> |
| R15 POST /admin/reports/{reportId}/support-requests/{requestId}/participants | expectedVersion, 같은 행사 타 관리자·활성 요청 | 201 `{participation:Participation,reportVersion:integer}` |
| R16 PATCH /admin/reports/{reportId}/support-requests/{requestId}/participants/{participationId}/cancel | expectedVersion, 참여 본인·해당 참여 활성 | 200 `{participation:Participation,reportVersion:integer}` |

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
