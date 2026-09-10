# 신고 담당·완료·취소 API

> 검토안·미구현. 기준: [처리 권한](../../features/report-lifecycle.md), [관제](../../features/command-dashboard.md). 모델·오류·경합 우선순위는 [공통 규칙](common.md).

## 처리 액션

모든 작업은 ADMIN 같은 행사, Idempotency-Key 및 expectedVersion이 필요합니다. 성공은 **200 ReportDetail**이며 변경 후 version을 반환합니다. 업무 변경과 이력은 함께 기록합니다. 성공 재전송은 최초 결과를 돌려줍니다. 새 키로 같은 종결 동작을 반복하면 409 INVALID_REPORT_STATE입니다.

## 바로 찾기

- [R07 · 담당 배정·분류 확정](#r07)
- [R08 · 유형·위험도 수정](#r08)
- [R09 · 신고 완료](#r09)
- [R10 · 담당 배정 취소](#r10)
- [R11 · 신고 취소](#r11)

<a id="r07"></a>

## R07 · 담당 배정·분류 확정

```http
PATCH /api/v1/admin/reports/{reportId}/claim
```

### 요청 Body

| 필드 | 타입 | 필수 여부 |
|---|---|---|
| `expectedVersion` | integer ≥ 1 | 필수 |
| `type` | ReportType | 필수 |
| `urgency` | Urgency | 필수 |

### 성공 응답

**200** · [ReportDetail](models.md#reportdetail)

### 권한·처리 규칙

RECEIVED. 담당·IN_PROGRESS·유형/위험도 ADMIN_CONFIRMED를 함께 저장

### 오류

[처리 액션 공통 규칙](#처리-액션)을 따릅니다.

<a id="r08"></a>

## R08 · 유형·위험도 수정

```http
PATCH /api/v1/admin/reports/{reportId}/classification
```

### 요청 Body

| 필드 | 타입 | 필수 여부 |
|---|---|---|
| `expectedVersion` | integer ≥ 1 | 필수 |
| `type` | ReportType | 선택 |
| `urgency` | Urgency | 선택 |

### 성공 응답

**200** · [ReportDetail](models.md#reportdetail)

### 권한·처리 규칙

IN_PROGRESS 현재 담당자, type/urgency 최소 하나, null 불가

### 오류

[처리 액션 공통 규칙](#처리-액션)을 따릅니다.

<a id="r09"></a>

## R09 · 신고 완료

```http
PATCH /api/v1/admin/reports/{reportId}/resolve
```

### 요청 Body

| 필드 | 타입 | 필수 여부 |
|---|---|---|
| `expectedVersion` | integer ≥ 1 | 필수 |
| `resolveNote` | string 또는 null | 선택 |

### 성공 응답

**200** · [ReportDetail](models.md#reportdetail)

### 권한·처리 규칙

IN_PROGRESS 현재 담당자, RESOLVED·resolvedAt 기록. 메모 생략/null/공백은 null 제안

### 오류

[처리 액션 공통 규칙](#처리-액션)을 따릅니다.

<a id="r10"></a>

## R10 · 담당 배정 취소

```http
PATCH /api/v1/admin/reports/{reportId}/release
```

### 요청 Body

| 필드 | 타입 | 필수 여부 |
|---|---|---|
| `expectedVersion` | integer ≥ 1 | 필수 |

### 성공 응답

**200** · [ReportDetail](models.md#reportdetail)

### 권한·처리 규칙

IN_PROGRESS 현재 담당자, RECEIVED·현재 담당/claimedAt 해제, createdAt·과거 이력 유지

### 오류

[처리 액션 공통 규칙](#처리-액션)을 따릅니다.

<a id="r11"></a>

## R11 · 신고 취소

```http
PATCH /api/v1/admin/reports/{reportId}/cancel
```

### 요청 Body

| 필드 | 타입 | 필수 여부 |
|---|---|---|
| `expectedVersion` | integer ≥ 1 | 필수 |
| `cancelReason` | string | 필수 |

### 성공 응답

**200** · [ReportDetail](models.md#reportdetail)

### 권한·처리 규칙

RECEIVED 또는 IN_PROGRESS, 같은 행사 관리자 누구나, 필수 사유·cancelledBy·cancelledAt 기록

### 오류

[처리 액션 공통 규칙](#처리-액션)을 따릅니다.

## 공통 처리 규칙

R07은 값을 수정하지 않아도 두 분류를 관리자 확인으로 남깁니다. R08은 보낸 필드만 관리자 확인 정보로 갱신하고 생략한 필드는 유지합니다. 동시에 claim이 경합하면 한 명만 배정·분류 저장에 성공하며 다른 요청은 409로 최신 조회를 안내합니다. 별도 분류 저장을 먼저 호출하지 않습니다.

R10에서 note를 받지 않는 것은 사유 정책 미정(TBD-07)에 대한 최소 계약 제안입니다. 사유 입력을 채택하면 선택/필수를 별도로 정의합니다. R11은 목록 X·상세 취소가 동일 API를 사용하며 DELETE/hide API는 없습니다. 완료·취소 시 기존 담당은 이력 식별을 위해 유지하는 제안입니다.

오류: 401/403/404/422 및 STALE_VERSION·INVALID_REPORT_STATE·공통 멱등성 오류. 다른 담당자의 완료/분류/해제는 403입니다. 신고가 종결된 경우 새 변경은 409입니다. 권한을 얻지 못한 클라이언트가 ‘지원 참여자’라는 이유로 담당 작업을 수행할 수 없습니다.

```json
{
  "expectedVersion": 1,
  "type": "CROWD",
  "urgency": "URGENT"
}
```

```json
{
  "expectedVersion": 4,
  "cancelReason": "동일 상황의 중복 신고로 확인했습니다."
}
```

