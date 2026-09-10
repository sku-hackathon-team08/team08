# 신고 조회 API

> 검토안·미구현. 기준: [처리 권한](../../features/report-lifecycle.md), [관제](../../features/command-dashboard.md). 모델·오류·경합 우선순위는 [공통 규칙](common.md).

## 조회

## 바로 찾기

- [R01 · 내 신고 목록](#r01)
- [R02 · 내 신고 상세](#r02)
- [R03 · 관제 신고 목록](#r03)
- [R04 · 관제 신고 상세](#r04)
- [R05 · 지도 핀 목록](#r05)
- [R06 · 신고 처리 이력](#r06)

<a id="r01"></a>

## R01 · 내 신고 목록

```http
GET /api/v1/staff/reports
```

### 권한·요청

STAFF 본인, cursor?,pageSize?

### 성공 응답

**200** · Page<StaffReport>

### 오류

조회 공통 오류: 401 / 403 / 404, 쿼리 검증 422.

<a id="r02"></a>

## R02 · 내 신고 상세

```http
GET /api/v1/staff/reports/{reportId}
```

### 권한·요청

STAFF 본인

### 성공 응답

**200** · StaffReport

### 오류

조회 공통 오류: 401 / 403 / 404, 쿼리 검증 422.

<a id="r03"></a>

## R03 · 관제 신고 목록

```http
GET /api/v1/admin/reports
```

### 권한·요청

ADMIN 같은 행사, sort?=recent 또는 urgency, types?,statuses?,cursor?,pageSize?

### 성공 응답

**200** · Page<ReportCard>

### 오류

조회 공통 오류: 401 / 403 / 404, 쿼리 검증 422.

<a id="r04"></a>

## R04 · 관제 신고 상세

```http
GET /api/v1/admin/reports/{reportId}
```

### 권한·요청

ADMIN 같은 행사

### 성공 응답

**200** · ReportDetail

### 오류

조회 공통 오류: 401 / 403 / 404, 쿼리 검증 422.

<a id="r05"></a>

## R05 · 지도 핀 목록

```http
GET /api/v1/admin/map-reports
```

### 권한·요청

ADMIN 같은 행사, types?,statuses?,cursor?,pageSize?

### 성공 응답

**200** · Page<MapPin>

### 오류

조회 공통 오류: 401 / 403 / 404, 쿼리 검증 422.

<a id="r06"></a>

## R06 · 신고 처리 이력

```http
GET /api/v1/admin/reports/{reportId}/logs
```

### 권한·요청

ADMIN 같은 행사, cursor?,pageSize?

### 성공 응답

**200** · Page<Log>

### 오류

조회 공통 오류: 401 / 403 / 404, 쿼리 검증 422.

## 공통 처리 규칙

Page는 공통 `{items,nextCursor,asOf}`입니다. MapPin은 `id,version,position,status,type,urgency,isUnacknowledged`를 ReportCard에서 선택한 모델입니다. 공통 목록 기본 크기를 쓰되 지도는 다음 커서를 끝까지 조회합니다. 첫 페이지를 전체 핀처럼 표시하지 않으며 로딩/부분 수신 상태를 구분합니다. 전체 규모·클러스터링은 A-06 미정입니다.

types·statuses는 쉼표로 구분한 enum 목록, 미지정 시 허용값 전체 제안입니다. 빈 문자열·알 수 없는 값은 422입니다. R03/R05는 CANCELLED를 제외하고, 명시적 CANCELLED 필터는 422 제안입니다. R01/R02와 권한 있는 R04/R06에서는 취소 기록을 유지합니다.

정렬 제안: 먼저 미확인 우선, recent는 createdAt 내림차순·id 내림차순, urgency는 URGENT→CAUTION→NORMAL·createdAt 내림차순·id 내림차순. 필터가 먼저 대상을 제한하고 그 안에서 미확인 상단을 적용하는 안은 **TBD-05 의존 검토안**입니다. R01은 createdAt·id 내림차순, R06은 occurredAt·id 오름차순입니다.

isUnacknowledged는 RECEIVED이며 최초 createdAt부터 긴급 3분·주의 10분·일반 30분을 초과했을 때 true입니다. 버전과 별개로 서버 조회 시각에 계산합니다. release로 접수 복귀해도 createdAt은 유지합니다. 분류 변경 후 임계 기준은 TBD-05이며 기존 값으로 계산하는 구현을 임의 확정하지 않습니다.

Log.action 제안: REPORT_CREATED, REPORT_CLAIMED, CLASSIFICATION_CHANGED, ASSIGNMENT_RELEASED, REPORT_RESOLVED, REPORT_CANCELLED, SUPPORT_REQUEST_OPENED, SUPPORT_REQUEST_CLOSED, SUPPORT_JOINED, SUPPORT_LEFT. 변경 내역은 허용된 공개 필드만 넣고 내부 토큰·DB 컬럼을 포함하지 않습니다.

조회 오류: 공통 401/403/404, 쿼리 검증 422. 실시간 갱신은 조회 기반 시작안이며 WebSocket·SSE 계약을 확정하지 않습니다.

