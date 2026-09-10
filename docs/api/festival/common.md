# 공통 모델·요청 규칙

> 검토안·미구현. 모든 축제 API에 적용할 제안입니다. 기존 `/health` 계약은 변경하지 않습니다.

## 표현 규칙

- 기준 경로는 `/api/v1` 제안이며 각 문서의 경로에 붙입니다.
- JSON과 쿼리는 확정된 camelCase입니다. JSON 요청·응답은 `application/json`, 음성 업로드만 multipart입니다.
- ID는 UUID 문자열, 시각은 UTC RFC 3339 문자열(`2026-09-10T03:00:00Z`) 제안입니다. 숫자 초·미터는 해당 단위를 이름에 씁니다.
- 아래 모델의 필드는 별도 설명이 없으면 응답에 항상 존재합니다. `?`는 요청에서 생략 가능, `T|null`은 명시적 null 허용입니다. 빈 목록은 `[]`, 마지막 커서는 null입니다.
- 요청의 미등록 필드는 거절하는 제안입니다. 소유자·역할·상태·구역·이력·출처를 클라이언트 입력으로 덮어쓰지 않습니다. 외부 snake_case를 대체 이름으로 사용하지 않습니다.
- 입력 문자열은 앞뒤 공백 제거 후 필수 문자열이 비어 있으면 422입니다. 길이·음성 크기 상한은 미정이며 임의 숫자를 확정하지 않습니다.
- 성공은 모델 자체를 반환하고 `{data: ...}`로 감싸지 않습니다. 204는 본문 없이 응답합니다.

## 역할·인증

Bearer 세션을 시작안으로 제안합니다. 세션은 행사·역할·행위자 한 명에 귀속합니다. 서버는 이 값에서 조회 범위·변경자를 결정합니다. 클라이언트의 eventId/adminId로 다른 행사·사용자를 선택하지 않습니다.

세션 생성의 관리자 자격 검증·토큰 만료/갱신·로그아웃과 앱 저장 방식은 미정입니다. 코드와 이름만 알고 있다고 관리자 자격이 검증된 것으로 간주하지 않습니다. event-entry의 세션 API는 자격 정책을 확정해야 구현 가능합니다.

인증 없음/무효는 401, 같은 행사에서 역할 부족은 403, 다른 행사 또는 다른 스태프 소유 자원은 존재를 노출하지 않는 404 제안입니다. 관리자 상세는 같은 행사 취소 신고도 읽을 수 있습니다. 모든 변경·재전송 응답 복구에서도 현재 자원 접근 권한을 검사합니다.

## 공개 모델

| 모델 | 필드·타입 |
|---|---|
| Actor | id:string, name:string |
| Position | lat:number[-90,90], lng:number[-180,180], capturedAt:string, accuracyMeters:number≥0 또는 null |
| Classification | value:유형 또는 위험도 enum, source:AI_SUGGESTED / STAFF_EDITED / ADMIN_SELECTED / ADMIN_CONFIRMED, confirmedBy:Actor 또는 null, confirmedAt:string 또는 null |
| ReportCard | id:string, version:integer≥1, contentFinal:string, type:Classification, urgency:Classification, status:ReportStatus, position:Position, positionSource:GPS / MAP_SELECTED, zone:{id:string,name:string} 또는 null, createdAt:string, claimedBy:Actor 또는 null, claimedAt:string 또는 null, isUnacknowledged:boolean, supportRequestId:string 또는 null, activeSupporterCount:integer≥0 |
| ReportDetail | ReportCard + reporter:Actor, inputMethod:VOICE / TEXT, transcriptRaw:string, contentSuggested:string, typeSuggested:ReportType, urgencySuggested:Urgency, resolvedAt:string 또는 null, resolveNote:string 또는 null, cancelledAt:string 또는 null, cancelledBy:Actor 또는 null, cancelReason:string 또는 null |
| StaffReport | id:string, contentFinal:string, type:Classification, urgency:Classification, status:ReportStatus, position:Position, zone:{id:string,name:string} 또는 null, createdAt:string, claimedBy:Actor 또는 null, claimedAt:string 또는 null, resolvedAt:string 또는 null, cancelledAt:string 또는 null |
| Log | id:string, action:string, actor:Actor, occurredAt:string, changes:Change[], note:string 또는 null |
| Change | field:string, before:JSON 값 또는 null, after:JSON 값 또는 null |
| SupportRequest | id:string, reportId:string, openedBy:Actor, openedAt:string, closedAt:string 또는 null, closeReason:MANUAL / REPORT_RELEASED / REPORT_RESOLVED / REPORT_CANCELLED 또는 null |
| Participation | id:string, supportRequestId:string, actor:Actor, joinedAt:string, endedAt:string 또는 null, endReason:SELF_CANCELLED / REQUEST_CLOSED 또는 null |

ReportType은 EMERGENCY(긴급), FACILITY(시설), CROWD(혼잡), LOST(미아/분실), OTHER(기타), Urgency는 NORMAL(일반), CAUTION(주의), URGENT(긴급)입니다. ReportStatus는 RECEIVED / IN_PROGRESS / RESOLVED / CANCELLED입니다. 영문 값은 API 제안이며 UI의 한국어 기획 의미를 유지합니다.

미확인·지원요청은 신고 상태 enum에 추가하지 않습니다. 자동 위험도 승격 출처·시각은 이번 모델에 넣지 않습니다. 위치 출처는 역할별 접수 경로에서 서버가 결정합니다. `confirmedBy`·`confirmedAt`은 관리자 확정/수정에서만 채우며 AI·스태프 단계에는 null입니다.

`createdAt`은 최초 서버 접수 시각이며 변경하지 않습니다. `claimedAt`은 현재 배정 시각으로 해제 시 null입니다. 과거 배정 시각은 이력에 남깁니다. 재배정 신고의 처리시간은 이 필드 하나로 임의 계산하지 않습니다.

StaffReport는 내역용 최소 공개 모델입니다. 관리자 내부 메모·취소 사유 공개 범위는 TBD-10이므로 이 모델에 노출하지 않는 제안입니다. 확정 후 확장합니다. 상세 이력·지원 목록은 무한 배열로 넣지 않고 별도 조회합니다.

## 목록

페이지 목록은 `{items:T[], nextCursor:string|null, asOf:string}`입니다. `cursor?`는 불투명 문자열, `pageSize?`는 정수 기본 20·최대 100 제안입니다. 경계 초과·잘못된 커서는 422입니다. 커서는 행사·행위자·필터·정렬에 귀속하고 다른 조건으로 재사용하면 422입니다.

완전한 시점 스냅샷은 보장하지 않는 시작안입니다. 클라이언트는 ID로 중복 제거하고 첫 페이지를 새로고침합니다. 상태가 바뀌는 목록에서 페이지 사이 누락이 생길 수 있으며 영구 누락처럼 유지하지 않도록 새로고침합니다. 원문·이력 전체를 목록에 포함하지 않습니다.

## 재전송·동시성

모든 POST·PATCH에는 `Idempotency-Key` 문자열 헤더를 필수로 제안합니다. 하나의 사용자 동작에서 생성한 키는 응답 유실 후에도 유지합니다. 새로운 참여·재요청 같은 새 의도는 새 키를 사용합니다. 키 형식은 UUID 문자열 제안입니다.

범위는 행사(없으면 신청 자격)·행위자·메서드·정규 경로·키입니다. 같은 키/같은 본문은 최초 상태 코드와 결과를 반환하고, 다른 본문은 409 IDEMPOTENCY_CONFLICT입니다. 처리중 재시도는 409 REQUEST_IN_PROGRESS로 구분합니다. 파일 요청의 비교에는 파일 내용도 포함합니다. 미완료 실패의 재시도·결과 보관 기간은 A-04에서 결정합니다. 보관 기간을 정하지 않은 채 무기한 중복 방지를 보장하지 않습니다.

처리 액션은 `expectedVersion:integer≥1`을 요구합니다. 버전 불일치는 409 STALE_VERSION으로 거절합니다. 업무 상태 변경과 필요한 이력은 함께 성공하거나 함께 실패해야 합니다. 재전송 결과 복구는 새 버전 검사보다 먼저 수행하되 인증·접근 권한 검사는 생략하지 않습니다.

보고서의 담당·분류·종결·지원 요청·참여 변경마다 report.version을 증가시키는 단순안을 제안합니다. 지원자가 동시에 여러 명 참여하면 일부가 STALE_VERSION을 받을 수 있어 새 상세 조회 후 다시 시도합니다. 인원 상한으로 거절하는 것은 아닙니다. 이 경합 비용은 A-05에서 검토합니다.

GET 응답의 version이 클라이언트 보유 값보다 낮으면 현재 상태를 되돌리지 않습니다. `isUnacknowledged`는 시간만으로 바뀔 수 있으므로 같은 version에서는 asOf가 최신인 조회를 적용합니다. 리스트와 지도는 각각의 asOf를 갖고 원자적 스냅샷으로 간주하지 않습니다.

## 오류

오류 본문의 목표 형식은 [공통 오류](../errors.md)입니다. 현재 구현은 401·403·409 등의 공통 변환과 422 필드 오류 변환을 제공하지 않습니다. 이 문서의 오류는 구현 예정 계약입니다.

| HTTP / code | 발생 조건·대응 |
|---|---|
| 401 UNAUTHENTICATED | 세션 없음/무효/만료, 재인증 |
| 403 FORBIDDEN | 역할·담당자·본인 참여 권한 부족 |
| 404 NOT_FOUND | 경로 자원 없음 또는 허용 범위 밖 |
| 409 STALE_VERSION | 최신 상세 조회 후 의도 재확인 |
| 409 INVALID_REPORT_STATE | 종결 또는 지원 요청 종료 등 불가능한 상태 |
| 409 IDEMPOTENCY_CONFLICT | 키를 다른 입력에 재사용, 자동 재시도 금지 |
| 409 REQUEST_IN_PROGRESS | 동일 키 작업 진행중, 결과 확인 후 재시도 |
| 409 ANALYSIS_NOT_READY | 분석이 완료되지 않았거나 실패 |
| 409 ANALYSIS_EXPIRED | 분석 유효기간 종료, 재분석 필요 |
| 409 ANALYSIS_ALREADY_USED | 다른 전송 의도로 이미 사용한 분석 |
| 422 VALIDATION_ERROR | 필수·타입·enum·범위·빈 사유·미등록 필드 |
| 413 AUDIO_TOO_LARGE | 합의할 음성 크기 상한 초과 |
| 415 UNSUPPORTED_MEDIA_TYPE | 합의할 오디오 형식 또는 요청 콘텐츠 유형 외 입력 |
| 503 PROVIDER_UNAVAILABLE | 동기 지도/경로 제공자 장애 |

인증·자원 범위 → 멱등 재응답 → 입력/버전·업무 조건 확인 순서를 적용하는 제안입니다. 버전과 상태가 모두 다르면 STALE_VERSION을 우선합니다. 422는 입력 파싱 단계에서 먼저 발생할 수 있습니다. 서버 오류는 500 INTERNAL_SERVER_ERROR, 지원하지 않는 메서드는 기존 405를 따릅니다.

```json
{"status":409,"code":"STALE_VERSION","detail":"신고 정보가 변경되었습니다. 최신 내용을 확인해주세요.","errors":[]}
```

헤더·요청 취소·네트워크 오류를 JSON 업무 오류와 혼동하지 않습니다. 타임아웃은 서버 작업 취소를 의미하지 않습니다. 오류 보관 정책·재시도 간격·요청 제한은 후속 결정입니다.
