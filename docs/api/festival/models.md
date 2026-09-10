# 응답 모델 사전

> 검토안·미구현. 필드명·타입·null 허용은 기존 v0.1 제안과 같습니다.

[API 목차](../festival.md) · [공통 규칙](common.md)

### Actor

| 필드 | 타입·허용값 |
|---|---|
| `id` | string |
| `name` | string |

### Position

| 필드 | 타입·허용값 |
|---|---|
| `lat` | number[-90,90] |
| `lng` | number[-180,180] |
| `capturedAt` | string |
| `accuracyMeters` | number≥0 또는 null |

### Classification

| 필드 | 타입·허용값 |
|---|---|
| `value` | 유형 또는 위험도 enum |
| `source` | AI_SUGGESTED / STAFF_EDITED / ADMIN_SELECTED / ADMIN_CONFIRMED |
| `confirmedBy` | Actor 또는 null |
| `confirmedAt` | string 또는 null |

### ReportCard

| 필드 | 타입·허용값 |
|---|---|
| `id` | string |
| `version` | integer≥1 |
| `contentFinal` | string |
| `type` | Classification |
| `urgency` | Classification |
| `status` | ReportStatus |
| `position` | Position |
| `positionSource` | GPS / MAP_SELECTED |
| `zone` | object 또는 null |
| `zone.id` | string |
| `zone.name` | string |
| `createdAt` | string |
| `claimedBy` | Actor 또는 null |
| `claimedAt` | string 또는 null |
| `isUnacknowledged` | boolean |
| `supportRequestId` | string 또는 null |
| `activeSupporterCount` | integer≥0 |

### ReportDetail

[ReportCard](#reportcard)의 모든 필드에 아래를 추가합니다.

| 필드 | 타입·허용값 |
|---|---|
| `reporter` | Actor |
| `inputMethod` | VOICE / TEXT |
| `transcriptRaw` | string |
| `contentSuggested` | string |
| `typeSuggested` | ReportType |
| `urgencySuggested` | Urgency |
| `resolvedAt` | string 또는 null |
| `resolveNote` | string 또는 null |
| `cancelledAt` | string 또는 null |
| `cancelledBy` | Actor 또는 null |
| `cancelReason` | string 또는 null |

### StaffReport

| 필드 | 타입·허용값 |
|---|---|
| `id` | string |
| `contentFinal` | string |
| `type` | Classification |
| `urgency` | Classification |
| `status` | ReportStatus |
| `position` | Position |
| `zone` | object 또는 null |
| `zone.id` | string |
| `zone.name` | string |
| `createdAt` | string |
| `claimedBy` | Actor 또는 null |
| `claimedAt` | string 또는 null |
| `resolvedAt` | string 또는 null |
| `cancelledAt` | string 또는 null |

### Log

| 필드 | 타입·허용값 |
|---|---|
| `id` | string |
| `action` | string |
| `actor` | Actor |
| `occurredAt` | string |
| `changes` | Change[] |
| `note` | string 또는 null |

### Change

| 필드 | 타입·허용값 |
|---|---|
| `field` | string |
| `before` | JSON 값 또는 null |
| `after` | JSON 값 또는 null |

### SupportRequest

| 필드 | 타입·허용값 |
|---|---|
| `id` | string |
| `reportId` | string |
| `openedBy` | Actor |
| `openedAt` | string |
| `closedAt` | string 또는 null |
| `closeReason` | MANUAL / REPORT_RELEASED / REPORT_RESOLVED / REPORT_CANCELLED 또는 null |

### Participation

| 필드 | 타입·허용값 |
|---|---|
| `id` | string |
| `supportRequestId` | string |
| `actor` | Actor |
| `joinedAt` | string |
| `endedAt` | string 또는 null |
| `endReason` | SELF_CANCELLED / REQUEST_CLOSED 또는 null |

ReportType은 EMERGENCY(긴급), FACILITY(시설), CROWD(혼잡), LOST(미아/분실), OTHER(기타), Urgency는 NORMAL(일반), CAUTION(주의), URGENT(긴급)입니다. ReportStatus는 RECEIVED / IN_PROGRESS / RESOLVED / CANCELLED입니다. 영문 값은 API 제안이며 UI의 한국어 기획 의미를 유지합니다.

미확인·지원요청은 신고 상태 enum에 추가하지 않습니다. 자동 위험도 승격 출처·시각은 이번 모델에 넣지 않습니다. 위치 출처는 역할별 접수 경로에서 서버가 결정합니다. `confirmedBy`·`confirmedAt`은 관리자 확정/수정에서만 채우며 AI·스태프 단계에는 null입니다.

`createdAt`은 최초 서버 접수 시각이며 변경하지 않습니다. `claimedAt`은 현재 배정 시각으로 해제 시 null입니다. 과거 배정 시각은 이력에 남깁니다. 재배정 신고의 처리시간은 이 필드 하나로 임의 계산하지 않습니다.

StaffReport는 내역용 최소 공개 모델입니다. 관리자 내부 메모·취소 사유 공개 범위는 TBD-10이므로 이 모델에 노출하지 않는 제안입니다. 확정 후 확장합니다. 상세 이력·지원 목록은 무한 배열로 넣지 않고 별도 조회합니다.
