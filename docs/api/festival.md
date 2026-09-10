# 축제 서비스 API 명세 v0.1

> 상태: **검토안·미구현** · 2026-09-10 · 기준: [PRD v1.2](../prd/index.md).
> 경로·필드·인증·오류·동시성 방식은 이번에 작성한 제안입니다. 제품 확정과 API 계약 확정을 구분합니다. 기존 [네이밍](naming.md)·[공통 오류](errors.md)의 확정 사항은 유지합니다.

## 문서 안내

이 문서 하나에서 전체 API를 리뷰할 수 있습니다. 목차 링크는 모두 같은 문서 안에서 이동합니다.

- 처음 보는 경우: 아래 **API 목록**에서 필요한 기능을 선택합니다.
- 공통 응답 필드: [응답 모델 사전](#응답-모델-사전)
- 인증·오류·재전송 확인: [공통 규칙](#공통-모델요청-규칙)
- 아직 결정하지 않은 내용: [검토 목록](#api-검증결정-목록)

## API 목록

### 행사·진입

| ID | 기능 | Method |
|---|---|---|
| E01 | [행사 신청](#e01--행사-신청) | `POST` |
| E02 | [행사 신청 조회](#e02--행사-신청-조회) | `GET` |
| E03 | [세션 생성](#e03--세션-생성) | `POST` |
| E04 | [내 세션 조회](#e04--내-세션-조회) | `GET` |
| E05 | [행사 지도 조회](#e05--행사-지도-조회) | `GET` |

### 신고 입력

| ID | 기능 | Method |
|---|---|---|
| I01 | [신고 내용 분석](#i01--신고-내용-분석) | `POST` |
| I02 | [분석 결과 조회](#i02--분석-결과-조회) | `GET` |
| I03 | [스태프 신고 전송](#i03--스태프-신고-전송) | `POST` |
| I04 | [관리자 직접 신고](#i04--관리자-직접-신고) | `POST` |

### 조회·처리·지원

| ID | 기능 | Method |
|---|---|---|
| R01 | [내 신고 목록](#r01--내-신고-목록) | `GET` |
| R02 | [내 신고 상세](#r02--내-신고-상세) | `GET` |
| R03 | [관제 신고 목록](#r03--관제-신고-목록) | `GET` |
| R04 | [관제 신고 상세](#r04--관제-신고-상세) | `GET` |
| R05 | [지도 핀 목록](#r05--지도-핀-목록) | `GET` |
| R06 | [신고 처리 이력](#r06--신고-처리-이력) | `GET` |
| R07 | [담당 배정·분류 확정](#r07--담당-배정분류-확정) | `PATCH` |
| R08 | [유형·위험도 수정](#r08--유형위험도-수정) | `PATCH` |
| R09 | [신고 완료](#r09--신고-완료) | `PATCH` |
| R10 | [담당 배정 취소](#r10--담당-배정-취소) | `PATCH` |
| R11 | [신고 취소](#r11--신고-취소) | `PATCH` |
| R12 | [지원요청 시작](#r12--지원요청-시작) | `POST` |
| R13 | [지원요청 종료](#r13--지원요청-종료) | `PATCH` |
| R14 | [지원 참여 목록](#r14--지원-참여-목록) | `GET` |
| R15 | [지원 참여](#r15--지원-참여) | `POST` |
| R16 | [본인 지원 참여 취소](#r16--본인-지원-참여-취소) | `PATCH` |

### 통계·내보내기

| ID | 기능 | Method |
|---|---|---|
| O01 | [관제 통계](#o01--관제-통계) | `GET` |
| O02 | [내 활동 리포트](#o02--내-활동-리포트) | `GET` |
| O03 | [활동 리포트 PDF](#o03--활동-리포트-pdf) | `GET` |
| O04 | [접근 경로 조회](#o04--접근-경로-조회) | `GET` |

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

---

## 공통 모델·요청 규칙

> 검토안·미구현. 모든 축제 API에 적용할 제안입니다. 기존 `/health` 계약은 변경하지 않습니다.

### 표현 규칙

- 기준 경로는 `/api/v1` 제안이며 각 문서의 경로에 붙입니다.
- JSON과 쿼리는 확정된 camelCase입니다. JSON 요청·응답은 `application/json`, 음성 업로드만 multipart입니다.
- ID는 UUID 문자열, 시각은 UTC RFC 3339 문자열(`2026-09-10T03:00:00Z`) 제안입니다. 숫자 초·미터는 해당 단위를 이름에 씁니다.
- 아래 모델의 필드는 별도 설명이 없으면 응답에 항상 존재합니다. `?`는 요청에서 생략 가능, `T|null`은 명시적 null 허용입니다. 빈 목록은 `[]`, 마지막 커서는 null입니다.
- 요청의 미등록 필드는 거절하는 제안입니다. 소유자·역할·상태·구역·이력·출처를 클라이언트 입력으로 덮어쓰지 않습니다. 외부 snake_case를 대체 이름으로 사용하지 않습니다.
- 입력 문자열은 앞뒤 공백 제거 후 필수 문자열이 비어 있으면 422입니다. 길이·음성 크기 상한은 미정이며 임의 숫자를 확정하지 않습니다.
- 성공은 모델 자체를 반환하고 `{data: ...}`로 감싸지 않습니다. 204는 본문 없이 응답합니다.

### 역할·인증

Bearer 세션을 시작안으로 제안합니다. 세션은 행사·역할·행위자 한 명에 귀속합니다. 서버는 이 값에서 조회 범위·변경자를 결정합니다. 클라이언트의 eventId/adminId로 다른 행사·사용자를 선택하지 않습니다.

세션 생성의 관리자 자격 검증·토큰 만료/갱신·로그아웃과 앱 저장 방식은 미정입니다. 코드와 이름만 알고 있다고 관리자 자격이 검증된 것으로 간주하지 않습니다. event-entry의 세션 API는 자격 정책을 확정해야 구현 가능합니다.

인증 없음/무효는 401, 같은 행사에서 역할 부족은 403, 다른 행사 또는 다른 스태프 소유 자원은 존재를 노출하지 않는 404 제안입니다. 관리자 상세는 같은 행사 취소 신고도 읽을 수 있습니다. 모든 변경·재전송 응답 복구에서도 현재 자원 접근 권한을 검사합니다.

### 응답 모델

필드별 타입은 [응답 모델 사전](#응답-모델-사전)에서 확인합니다.

### 목록

페이지 목록은 `{items:T[], nextCursor:string|null, asOf:string}`입니다. `cursor?`는 불투명 문자열, `pageSize?`는 정수 기본 20·최대 100 제안입니다. 경계 초과·잘못된 커서는 422입니다. 커서는 행사·행위자·필터·정렬에 귀속하고 다른 조건으로 재사용하면 422입니다.

완전한 시점 스냅샷은 보장하지 않는 시작안입니다. 클라이언트는 ID로 중복 제거하고 첫 페이지를 새로고침합니다. 상태가 바뀌는 목록에서 페이지 사이 누락이 생길 수 있으며 영구 누락처럼 유지하지 않도록 새로고침합니다. 원문·이력 전체를 목록에 포함하지 않습니다.

### 재전송·동시성

모든 POST·PATCH에는 `Idempotency-Key` 문자열 헤더를 필수로 제안합니다. 하나의 사용자 동작에서 생성한 키는 응답 유실 후에도 유지합니다. 새로운 참여·재요청 같은 새 의도는 새 키를 사용합니다. 키 형식은 UUID 문자열 제안입니다.

범위는 행사(없으면 신청 자격)·행위자·메서드·정규 경로·키입니다. 같은 키/같은 본문은 최초 상태 코드와 결과를 반환하고, 다른 본문은 409 IDEMPOTENCY_CONFLICT입니다. 처리중 재시도는 409 REQUEST_IN_PROGRESS로 구분합니다. 파일 요청의 비교에는 파일 내용도 포함합니다. 미완료 실패의 재시도·결과 보관 기간은 A-04에서 결정합니다. 보관 기간을 정하지 않은 채 무기한 중복 방지를 보장하지 않습니다.

처리 액션은 `expectedVersion:integer≥1`을 요구합니다. 버전 불일치는 409 STALE_VERSION으로 거절합니다. 업무 상태 변경과 필요한 이력은 함께 성공하거나 함께 실패해야 합니다. 재전송 결과 복구는 새 버전 검사보다 먼저 수행하되 인증·접근 권한 검사는 생략하지 않습니다.

보고서의 담당·분류·종결·지원 요청·참여 변경마다 report.version을 증가시키는 단순안을 제안합니다. 지원자가 동시에 여러 명 참여하면 일부가 STALE_VERSION을 받을 수 있어 새 상세 조회 후 다시 시도합니다. 인원 상한으로 거절하는 것은 아닙니다. 이 경합 비용은 A-05에서 검토합니다.

GET 응답의 version이 클라이언트 보유 값보다 낮으면 현재 상태를 되돌리지 않습니다. `isUnacknowledged`는 시간만으로 바뀔 수 있으므로 같은 version에서는 asOf가 최신인 조회를 적용합니다. 리스트와 지도는 각각의 asOf를 갖고 원자적 스냅샷으로 간주하지 않습니다.

### 오류

오류 본문의 목표 형식은 [공통 오류](errors.md)입니다. 현재 구현은 401·403·409 등의 공통 변환과 422 필드 오류 변환을 제공하지 않습니다. 이 문서의 오류는 구현 예정 계약입니다.

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
{
  "status": 409,
  "code": "STALE_VERSION",
  "detail": "신고 정보가 변경되었습니다. 최신 내용을 확인해주세요.",
  "errors": []
}
```

헤더·요청 취소·네트워크 오류를 JSON 업무 오류와 혼동하지 않습니다. 타임아웃은 서버 작업 취소를 의미하지 않습니다. 오류 보관 정책·재시도 간격·요청 제한은 후속 결정입니다.

---

## 행사·세션·제공자 지도 API

> 검토안·미구현. 기준: [행사 진입](../features/event-entry.md). 공통 접두사·모델·오류는 [공통 규칙](#공통-모델요청-규칙).
> **조건부:** TBD-01·02·04(코드 발급, 자격, 지도 매칭, 앱 방식). 사용자 구역 편집 API는 없습니다.

### E01 · 행사 신청

```http
POST /api/v1/event-applications
```

행사 신청을 생성합니다. 신청자 자격 방식은 미정이며 공개 무인증 운영을 채택한 것이 아닙니다.

#### 요청 Body

| 필드 | 타입 | 필수 여부 |
|---|---|---|
| `eventName` | string | 필수 |
| `applicantName` | string | 필수 |
| `venueName` | string | 필수 |
| `startDate` | YYYY-MM-DD | 필수 |
| `endDate` | YYYY-MM-DD | 필수 |

 시작일≤종료일. 날짜를 자동으로 운영 시작/종료 시각으로 해석하지 않습니다. 장소 자유문자와 제공자 데이터의 매칭 방식은 TBD-02입니다. zones·gates·폴리곤 입력은 받지 않습니다.

#### 성공 응답 · 201

**Application 필드**

| 필드 | 타입·허용값 |
|---|---|
| `id` | string |
| `status` | PENDING / ISSUED |
| `eventId` | string / null |
| `eventCode` | string / null |

ISSUED일 때 eventId/eventCode를 함께 제공하고 PENDING에는 둘 다 null입니다. 신청 시 즉시 발급인지 준비 후 발급인지 미정이므로 둘 다 표현할 수 있는 제안입니다. 신청자 자동 관리자 로그인은 하지 않습니다.

**오류:** 422 입력 오류, 401/403 신청자 자격 오류(정책 결정 후), 공통 멱등성 오류. 미지원 장소의 반려·재신청은 상태/오류를 임의 확정하지 않고 A-01에서 결정합니다.

### E02 · 행사 신청 조회

```http
GET /api/v1/event-applications/{applicationId}
```

신청자 본인만 조회합니다. 200 Application. 본인 증명 수단은 A-01 미정이며 ID를 안다는 것만으로 행사 코드를 노출하지 않습니다. 401/403/404.

### E03 · 세션 생성

```http
POST /api/v1/sessions
```

역할별 진입을 하나의 계약으로 제안합니다.

#### 요청 Body

| 필드 | 타입 | 필수 여부 |
|---|---|---|
| `eventCode` | string | 필수 |
| `role` | STAFF / ADMIN | 필수 |
| `name` | string | 필수 |
| `team` | string | STAFF만 필수; ADMIN은 전송하지 않음 |

- 관리자 자격 증명 입력은 아직 정의하지 않았습니다. 현재 필드만으로 운영 인증을 구현하지 않습니다.

#### 성공 응답 · 201

**Session 필드**

| 필드 | 타입·허용값 |
|---|---|
| `token` | string |
| `expiresAt` | string |
| `role` | STAFF / ADMIN |
| `event` | object |
| `event.id` | string |
| `event.name` | string |
| `actor` | object |
| `actor.id` | string |
| `actor.name` | string |
| `actor.team` | string / null |

- 같은 이름의 동명이인을 자동으로 기존 계정으로 복구하지 않습니다. 역할·세션 재진입 동일인 처리와 코드 오류 표시는 A-02에서 결정합니다.
- **오류:** 422, 자격 불충족 401/403, 공통 멱등성 오류. 토큰 생성·만료 길이·발급 재시도 정책은 조건부입니다.

### E04 · 내 세션 조회

```http
GET /api/v1/sessions/me
```

인증한 본인의 `role,event,actor,expiresAt`을 200으로 반환합니다. token을 재노출하지 않습니다. 팀은 소속 표시이며 zoneId 필드는 없습니다. 401.

### E05 · 행사 지도 조회

```http
GET /api/v1/events/current/map
```

같은 행사 STAFF/ADMIN 읽기 권한으로 200 MapData를 반환하는 제안입니다.

**MapData 필드**

| 필드 | 타입·허용값 |
|---|---|
| `eventId` | string |
| `dataVersion` | string |
| `center` | object |
| `center.lat` | number |
| `center.lng` | number |
| `zones` | Zone[] |
| `gates` | Gate[] |
| `asOf` | string |

- Zone: `id:string,name:string,geometry:{type:"Polygon",coordinates:number[][][]}`. 좌표 배열 순서는 `[경도,위도]` 제안입니다. WGS84 경위도이며 첫/마지막 점은 같아야 합니다. 다중 구역 형상 지원은 제공 데이터 검증 후 확장합니다.
- Gate: `id:string,name:string,position:{lat:number,lng:number},zoneId:string|null`.
- 브이월드 타일 자체나 서버 비밀 키를 반환하지 않습니다. 클라이언트 지도 SDK·키 정책은 외부 연동 문서의 후속 계약입니다.
- 잘못된 행사·준비되지 않은 데이터를 빈 구역 배열로 성공 처리해 준비 완료처럼 보이지 않습니다. 준비중 상태의 HTTP/코드는 A-01에서 결정합니다.
- **오류:** 401/404, 실제 동기 제공자 호출 실패는 503. 저장된 구역 조회와 외부 지도 렌더 실패를 같은 오류로 취급하지 않습니다.

### 예시

```json
{
  "eventCode": "DEMO26",
  "role": "STAFF",
  "name": "김스태프",
  "team": "운영팀"
}
```

위 코드는 설명용입니다. 실제 코드 길이·문자 조합의 검증 기준이 아닙니다.

---

## 분석·신고 접수 API

> 검토안·미구현. 기준: [입력 흐름](../features/report-intake.md). 공통은 [공통 규칙](#공통-모델요청-규칙).
> GPS 실패·위치 허용 오차·입력/파일 제한·분석 실패 대안은 TBD-03·06입니다. 아래 접수는 정상 GPS 확보 흐름만 정의하며 GPS 실패 때 전송 차단/수동 대체를 확정하지 않습니다.

### I01 · 신고 내용 분석

```http
POST /api/v1/report-analyses
```

인증한 STAFF/ADMIN이 본인 분석을 생성합니다. 최종 신고는 아직 없습니다. ADMIN은 TEXT만 사용합니다.

- 텍스트 `application/json`:

**응답 필드**

| 필드 | 타입·허용값 |
|---|---|
| `inputMethod` | "TEXT" |
| `text` | string |

#### 요청 Body · 음성

`Content-Type: multipart/form-data`

| 필드 | 타입 | 필수 여부 |
|---|---|---|
| `inputMethod` | VOICE | 필수 |
| `audio` | 바이너리 파일 1개 | 필수 |

녹음 종료 후 업로드하는 제안입니다.

#### 성공 응답 · 202

**응답 필드**

| 필드 | 타입·허용값 |
|---|---|
| `id` | string |
| `status` | "PENDING" |

Location은 `/api/v1/report-analyses/{id}`입니다.
- 필수 헤더 Idempotency-Key. 같은 키로 재업로드해도 분석 작업을 중복 실행하지 않습니다.
**오류:** 401/403, 422 빈 텍스트/필드 오류, 413/415 파일 제한, 공통 멱등성 오류.
- 허용 코덱·MIME·파일 크기·녹음 길이·텍스트 길이·분석 보관 기간은 A-03 미정입니다.

### I02 · 분석 결과 조회

```http
GET /api/v1/report-analyses/{analysisId}
```

행사·분석 소유자 일치 시 200 Analysis를 반환합니다. 다른 행위자 분석은 404. 폴링을 시작안으로 제안하며 주기는 미정입니다.

#### 성공 응답 · 200 Analysis

| 필드 | 타입·허용값 |
|---|---|
| `id` | string |
| `status` | PENDING / PROCESSING / READY / FAILED |
| `transcriptRaw` | string / null |
| `contentSuggested` | string / null |
| `typeSuggested` | ReportType / null |
| `urgencySuggested` | Urgency / null |
| `expiresAt` | string / null |
| `failureCode` | string / null |

- READY: 원문·내용·유형·위험도는 모두 non-null, failureCode는 null.
- PENDING/PROCESSING: 결과 필드는 모두 null.
- FAILED: 결과 필드는 null, failureCode는 TRANSCRIPTION_FAILED 또는 ANALYSIS_FAILED 제안. 내부 제공자 오류 문자열은 노출하지 않습니다.
- 텍스트의 transcriptRaw는 최초 입력 원문입니다. 음성은 최초 STT 변환문이며 사용자의 수정 내용과 구분합니다.
- expiresAt은 실제 유효기간을 정한 후 채웁니다. null은 유효기간 정책 미설정이며 무기한 보존 확정이 아닙니다.
- 실패 분석에서 자동으로 ‘기타/주의’ 신고를 만들지 않습니다. 수동 전송 허용과 fallback 분류는 미정입니다.

### I03 · 스태프 신고 전송

```http
POST /api/v1/staff/reports
```

STAFF의 확인 화면 ‘전송하기’입니다.

#### 요청 Body

| 필드 | 타입 | 필수 여부 |
|---|---|---|
| `analysisId` | string | 필수 |
| `contentFinal` | string | 필수 |
| `type` | ReportType | 필수 |
| `urgency` | Urgency | 필수 |
| `position` | [Position](#position) | 필수 |

 inputMethod·원문·최초 AI 제안은 분석에서 가져옵니다.

- analysisId는 같은 행사·본인 소유·READY·유효한 분석이어야 합니다.

#### 성공 응답 · 201

[StaffReport](#staffreport). 상태 RECEIVED, claimedBy/claimedAt/resolvedAt/cancelledAt=null. createdAt은 서버 최종 접수 시각입니다. Location은 `/api/v1/staff/reports/{id}`입니다.
- 서버가 GPS 위치 출처와 현재 구역을 판정합니다. zoneId·positionSource·reporter·status·createdAt 입력은 거절합니다.
- 최종 type/urgency가 AI 제안과 다르면 STAFF_EDITED, 같으면 AI_SUGGESTED로 기록하는 제안입니다. 수정했다 원래 값으로 되돌린 UI 과정까지 ‘최종 값 변경’으로 기록하지 않습니다.
- 분석 하나는 최종 신고 하나에만 사용할 수 있는 제안입니다. 같은 Idempotency-Key 재시도는 최초 201을 복구하고, 다른 키로 재사용하면 409 ANALYSIS_ALREADY_USED입니다.
**오류:** 401/403/404, 409 ANALYSIS_NOT_READY/EXPIRED/ALREADY_USED, 422, 공통 멱등성 오류.

```json
{
  "analysisId": "89b72348-600e-4a27-b2b9-e9e6286f2558",
  "contentFinal": "메인무대 뒤 통로에 사람이 몰려 있어요",
  "type": "CROWD",
  "urgency": "CAUTION",
  "position": {
    "lat": 37.615,
    "lng": 127.013,
    "capturedAt": "2026-09-10T03:00:00Z",
    "accuracyMeters": 12
  }
}
```

예시 좌표와 시각은 실제 신고가 아닙니다. 위치 정확도·유효 시간 기준을 나타내지 않습니다.

### I04 · 관리자 직접 신고

```http
POST /api/v1/admin/reports
```

ADMIN의 지도 선택 직접 신고입니다.

#### 요청 Body

| 필드 | 타입 | 필수 여부 |
|---|---|---|
| `analysisId` | string | 필수 |
| `contentFinal` | string | 필수 |
| `type` | ReportType | 필수 |
| `position` | [Position](#position) | 필수 |

 분석은 본인 TEXT/READY여야 합니다. urgency 입력은 받지 않고 분석의 위험도 제안을 사용합니다.

#### 성공 응답 · 201

[ReportDetail](#reportdetail). 상태 RECEIVED, 담당 없음. type.source=ADMIN_SELECTED, urgency.source=AI_SUGGESTED입니다. `confirmedBy/confirmedAt`은 null이며 생성이 담당 배정·분류 확정을 대체하지 않습니다. positionSource=MAP_SELECTED입니다. 이후 claim으로 맡아야 합니다.

분석 소유권·단일 사용·멱등성·오류는 I03과 같습니다. 관리자가 편집할 위치의 capturedAt은 지도 선택 시각, accuracyMeters는 null입니다. 상세 확인 UI의 분석 호출 위치는 화면 연결 시 검토합니다.

### 오프라인 경계

음성·텍스트 초안과 전송 대기는 아직 서버 신고가 아닙니다. READY 분석을 참조한 최종 전송의 응답만 유실되었다면 동일 키로 복구합니다. 앱이 오프라인에서 새 분석을 완료했다고 표시하지 않습니다. 임시 분석 만료 후 대기 신고 처리, 앱 재설치·세션 만료 후 동일인 복구, 키 보관 기간은 A-02~04에서 결정합니다.

### 최종 접수 성공 응답 예시

다음은 I03의 201 StaffReport 예시입니다. ID·좌표·시각은 설명용입니다.

```json
{
  "id": "57d78bd1-e361-4ba0-9cf7-c2bebacbc9b1",
  "contentFinal": "메인무대 뒤 통로에 사람이 몰려 있어요",
  "type": {
    "value": "CROWD",
    "source": "AI_SUGGESTED",
    "confirmedBy": null,
    "confirmedAt": null
  },
  "urgency": {
    "value": "CAUTION",
    "source": "AI_SUGGESTED",
    "confirmedBy": null,
    "confirmedAt": null
  },
  "status": "RECEIVED",
  "position": {
    "lat": 37.615,
    "lng": 127.013,
    "capturedAt": "2026-09-10T03:00:00Z",
    "accuracyMeters": 12
  },
  "zone": {
    "id": "a67ed48a-3735-4e5e-a86c-3deac653b52f",
    "name": "메인무대"
  },
  "createdAt": "2026-09-10T03:00:05Z",
  "claimedBy": null,
  "claimedAt": null,
  "resolvedAt": null,
  "cancelledAt": null
}
```

---

## 신고 조회 API

> 검토안·미구현. 기준: [처리 권한](../features/report-lifecycle.md), [관제](../features/command-dashboard.md). 모델·오류·경합 우선순위는 [공통 규칙](#공통-모델요청-규칙).

### 조회

### R01 · 내 신고 목록

```http
GET /api/v1/staff/reports
```

#### 권한·요청

STAFF 본인, cursor?,pageSize?

#### 성공 응답

**200** · Page<StaffReport>

#### 오류

조회 공통 오류: 401 / 403 / 404, 쿼리 검증 422.

### R02 · 내 신고 상세

```http
GET /api/v1/staff/reports/{reportId}
```

#### 권한·요청

STAFF 본인

#### 성공 응답

**200** · StaffReport

#### 오류

조회 공통 오류: 401 / 403 / 404, 쿼리 검증 422.

### R03 · 관제 신고 목록

```http
GET /api/v1/admin/reports
```

#### 권한·요청

ADMIN 같은 행사, sort?=recent 또는 urgency, types?,statuses?,cursor?,pageSize?

#### 성공 응답

**200** · Page<ReportCard>

#### 오류

조회 공통 오류: 401 / 403 / 404, 쿼리 검증 422.

### R04 · 관제 신고 상세

```http
GET /api/v1/admin/reports/{reportId}
```

#### 권한·요청

ADMIN 같은 행사

#### 성공 응답

**200** · ReportDetail

#### 오류

조회 공통 오류: 401 / 403 / 404, 쿼리 검증 422.

### R05 · 지도 핀 목록

```http
GET /api/v1/admin/map-reports
```

#### 권한·요청

ADMIN 같은 행사, types?,statuses?,cursor?,pageSize?

#### 성공 응답

**200** · Page<MapPin>

#### 오류

조회 공통 오류: 401 / 403 / 404, 쿼리 검증 422.

### R06 · 신고 처리 이력

```http
GET /api/v1/admin/reports/{reportId}/logs
```

#### 권한·요청

ADMIN 같은 행사, cursor?,pageSize?

#### 성공 응답

**200** · Page<Log>

#### 오류

조회 공통 오류: 401 / 403 / 404, 쿼리 검증 422.

### 공통 처리 규칙

Page는 공통 `{items,nextCursor,asOf}`입니다. MapPin은 `id,version,position,status,type,urgency,isUnacknowledged`를 ReportCard에서 선택한 모델입니다. 공통 목록 기본 크기를 쓰되 지도는 다음 커서를 끝까지 조회합니다. 첫 페이지를 전체 핀처럼 표시하지 않으며 로딩/부분 수신 상태를 구분합니다. 전체 규모·클러스터링은 A-06 미정입니다.

types·statuses는 쉼표로 구분한 enum 목록, 미지정 시 허용값 전체 제안입니다. 빈 문자열·알 수 없는 값은 422입니다. R03/R05는 CANCELLED를 제외하고, 명시적 CANCELLED 필터는 422 제안입니다. R01/R02와 권한 있는 R04/R06에서는 취소 기록을 유지합니다.

정렬 제안: 먼저 미확인 우선, recent는 createdAt 내림차순·id 내림차순, urgency는 URGENT→CAUTION→NORMAL·createdAt 내림차순·id 내림차순. 필터가 먼저 대상을 제한하고 그 안에서 미확인 상단을 적용하는 안은 **TBD-05 의존 검토안**입니다. R01은 createdAt·id 내림차순, R06은 occurredAt·id 오름차순입니다.

isUnacknowledged는 RECEIVED이며 최초 createdAt부터 긴급 3분·주의 10분·일반 30분을 초과했을 때 true입니다. 버전과 별개로 서버 조회 시각에 계산합니다. release로 접수 복귀해도 createdAt은 유지합니다. 분류 변경 후 임계 기준은 TBD-05이며 기존 값으로 계산하는 구현을 임의 확정하지 않습니다.

Log.action 제안: REPORT_CREATED, REPORT_CLAIMED, CLASSIFICATION_CHANGED, ASSIGNMENT_RELEASED, REPORT_RESOLVED, REPORT_CANCELLED, SUPPORT_REQUEST_OPENED, SUPPORT_REQUEST_CLOSED, SUPPORT_JOINED, SUPPORT_LEFT. 변경 내역은 허용된 공개 필드만 넣고 내부 토큰·DB 컬럼을 포함하지 않습니다.

조회 오류: 공통 401/403/404, 쿼리 검증 422. 실시간 갱신은 조회 기반 시작안이며 WebSocket·SSE 계약을 확정하지 않습니다.

---

## 신고 담당·완료·취소 API

> 검토안·미구현. 기준: [처리 권한](../features/report-lifecycle.md), [관제](../features/command-dashboard.md). 모델·오류·경합 우선순위는 [공통 규칙](#공통-모델요청-규칙).

### 처리 액션

모든 작업은 ADMIN 같은 행사, Idempotency-Key 및 expectedVersion이 필요합니다. 성공은 **200 ReportDetail**이며 변경 후 version을 반환합니다. 업무 변경과 이력은 함께 기록합니다. 성공 재전송은 최초 결과를 돌려줍니다. 새 키로 같은 종결 동작을 반복하면 409 INVALID_REPORT_STATE입니다.

### R07 · 담당 배정·분류 확정

```http
PATCH /api/v1/admin/reports/{reportId}/claim
```

#### 요청 Body

| 필드 | 타입 | 필수 여부 |
|---|---|---|
| `expectedVersion` | integer ≥ 1 | 필수 |
| `type` | ReportType | 필수 |
| `urgency` | Urgency | 필수 |

#### 성공 응답

**200** · [ReportDetail](#reportdetail)

#### 권한·처리 규칙

RECEIVED. 담당·IN_PROGRESS·유형/위험도 ADMIN_CONFIRMED를 함께 저장

#### 오류

[처리 액션 공통 규칙](#처리-액션)을 따릅니다.

### R08 · 유형·위험도 수정

```http
PATCH /api/v1/admin/reports/{reportId}/classification
```

#### 요청 Body

| 필드 | 타입 | 필수 여부 |
|---|---|---|
| `expectedVersion` | integer ≥ 1 | 필수 |
| `type` | ReportType | 선택 |
| `urgency` | Urgency | 선택 |

#### 성공 응답

**200** · [ReportDetail](#reportdetail)

#### 권한·처리 규칙

IN_PROGRESS 현재 담당자, type/urgency 최소 하나, null 불가

#### 오류

[처리 액션 공통 규칙](#처리-액션)을 따릅니다.

### R09 · 신고 완료

```http
PATCH /api/v1/admin/reports/{reportId}/resolve
```

#### 요청 Body

| 필드 | 타입 | 필수 여부 |
|---|---|---|
| `expectedVersion` | integer ≥ 1 | 필수 |
| `resolveNote` | string 또는 null | 선택 |

#### 성공 응답

**200** · [ReportDetail](#reportdetail)

#### 권한·처리 규칙

IN_PROGRESS 현재 담당자, RESOLVED·resolvedAt 기록. 메모 생략/null/공백은 null 제안

#### 오류

[처리 액션 공통 규칙](#처리-액션)을 따릅니다.

### R10 · 담당 배정 취소

```http
PATCH /api/v1/admin/reports/{reportId}/release
```

#### 요청 Body

| 필드 | 타입 | 필수 여부 |
|---|---|---|
| `expectedVersion` | integer ≥ 1 | 필수 |

#### 성공 응답

**200** · [ReportDetail](#reportdetail)

#### 권한·처리 규칙

IN_PROGRESS 현재 담당자, RECEIVED·현재 담당/claimedAt 해제, createdAt·과거 이력 유지

#### 오류

[처리 액션 공통 규칙](#처리-액션)을 따릅니다.

### R11 · 신고 취소

```http
PATCH /api/v1/admin/reports/{reportId}/cancel
```

#### 요청 Body

| 필드 | 타입 | 필수 여부 |
|---|---|---|
| `expectedVersion` | integer ≥ 1 | 필수 |
| `cancelReason` | string | 필수 |

#### 성공 응답

**200** · [ReportDetail](#reportdetail)

#### 권한·처리 규칙

RECEIVED 또는 IN_PROGRESS, 같은 행사 관리자 누구나, 필수 사유·cancelledBy·cancelledAt 기록

#### 오류

[처리 액션 공통 규칙](#처리-액션)을 따릅니다.

### 공통 처리 규칙

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

---

## 지원 요청·참여 API

> 검토안·미구현. 기준: [처리 권한](../features/report-lifecycle.md), [관제](../features/command-dashboard.md). 모델·오류·경합 우선순위는 [공통 규칙](#공통-모델요청-규칙).

### 지원 요청

요청과 참여에 각각 ID를 부여합니다. 새 요청은 새 ID, 본인 취소 후 재참여도 새 참여 ID입니다. 과거 참여를 다시 활성화하지 않는 API 제안으로 지연된 취소가 새 참여를 끝내지 못하게 합니다.

### R12 · 지원요청 시작

```http
POST /api/v1/admin/reports/{reportId}/support-requests
```

#### 권한·요청

expectedVersion, IN_PROGRESS 담당자·현재 활성 요청 없음

#### 성공 응답

201 `{supportRequest:SupportRequest,reportVersion:integer}`

#### 오류

지원 공통 오류: 401 / 403 / 404 / 422 / 409. 상세 조건은 아래 공통 처리 규칙을 따릅니다.

### R13 · 지원요청 종료

```http
PATCH /api/v1/admin/reports/{reportId}/support-requests/{requestId}/close
```

#### 권한·요청

expectedVersion, 현재 담당자·해당 활성 요청

#### 성공 응답

200 `{supportRequest:SupportRequest,reportVersion:integer}`

#### 오류

지원 공통 오류: 401 / 403 / 404 / 422 / 409. 상세 조건은 아래 공통 처리 규칙을 따릅니다.

### R14 · 지원 참여 목록

```http
GET /api/v1/admin/reports/{reportId}/support-requests/{requestId}/participants
```

#### 권한·요청

같은 행사 ADMIN, cursor?,pageSize?

#### 성공 응답

Page<Participation>

#### 오류

지원 공통 오류: 401 / 403 / 404 / 422 / 409. 상세 조건은 아래 공통 처리 규칙을 따릅니다.

### R15 · 지원 참여

```http
POST /api/v1/admin/reports/{reportId}/support-requests/{requestId}/participants
```

#### 권한·요청

expectedVersion, 같은 행사 타 관리자·활성 요청

#### 성공 응답

201 `{participation:Participation,reportVersion:integer}`

#### 오류

지원 공통 오류: 401 / 403 / 404 / 422 / 409. 상세 조건은 아래 공통 처리 규칙을 따릅니다.

### R16 · 본인 지원 참여 취소

```http
PATCH /api/v1/admin/reports/{reportId}/support-requests/{requestId}/participants/{participationId}/cancel
```

#### 권한·요청

expectedVersion, 참여 본인·해당 참여 활성

#### 성공 응답

200 `{participation:Participation,reportVersion:integer}`

#### 오류

지원 공통 오류: 401 / 403 / 404 / 422 / 409. 상세 조건은 아래 공통 처리 규칙을 따릅니다.

### 공통 처리 규칙

- R12는 최초 참여자 0명으로 시작합니다. 이미 활성 요청이면 새 요청을 만들지 않고 409 INVALID_REPORT_STATE 제안입니다.
- R13은 closeReason=MANUAL·closedAt을 기록하고 활성 참여 전부를 REQUEST_CLOSED로 종료합니다. report 상태와 담당은 유지합니다. 이후 R12는 새 요청을 만듭니다.
- R14는 해당 요청의 종료 참여도 반환하는 제안입니다. 활성 여부는 endedAt=null로 판단합니다. 과거 요청 ID는 로그 changes의 supportRequestId로 찾을 수 있습니다.
- R15의 행위자는 세션에서 가져옵니다. 담당자의 자기 지원과 이미 활성인 본인의 중복 참여는 409 INVALID_REPORT_STATE 제안입니다. 다른 사람 참여를 추가하는 adminId 입력은 받지 않습니다. 인원 수 제한이나 FULL 오류는 없습니다.
- R16은 SELF_CANCELLED·endedAt을 기록하고 다른 참여·신고 담당·지원요청은 유지합니다. 재참여는 R15에서 새 participationId로 시작합니다. 다른 사람 참여 취소는 403, 이미 끝난 참여를 새 키로 취소하면 409입니다.
- 동일 Idempotency-Key 재시도는 원래 201/200을 복구합니다. 새 요청이 열린 후 이전 requestId/participationId로 온 변경은 새 요청·참여를 변경하지 않습니다.
- 모든 경로 ID의 부모 reportId/requestId 일치를 검사합니다. 불일치는 404입니다. 성공·실패 모두 원래 담당자·claimedAt을 지원자로 바꾸지 않습니다.
- 오류는 공통 401/403/404/422/409입니다. reportVersion은 report.version과 같은 값입니다.

### 지원과 담당 해제·종결 — 조건부 보완안

TBD-07에 대해 release/resolve/cancel 시 활성 요청을 함께 닫고 해당 참여를 종료하는 방안을 제안합니다. closeReason은 각각 REPORT_RELEASED / REPORT_RESOLVED / REPORT_CANCELLED이며 참여 endReason은 REQUEST_CLOSED입니다. 신고 변경·요청 종료·참여 종료·이력은 함께 반영합니다.

이는 사용자가 확정한 ‘담당자의 수동 지원요청 종료’와 별개인 **미확정 제안**입니다. 이 정책이 채택되기 전에는 관련 동작의 전체 계약을 구현 승인으로 해석하지 않습니다. 어떤 경우에도 종결 뒤 새 지원을 생성하거나 과거 요청이 새 참여를 수정해서는 안 됩니다.

---

## 활동 리포트·PDF·경로 API

> **조건부 검토안·미구현**. 기준: [활동 리포트](../features/activity-report.md), [관제](../features/command-dashboard.md). 집계·PDF·경로 제공자를 이번 문서에서 확정하지 않습니다.

### O01 · 관제 통계

```http
GET /api/v1/admin/stats
```

같은 행사 ADMIN. 200

**응답 필드**

| 필드 | 타입·허용값 |
|---|---|
| `total` | integer |
| `unacknowledged` | integer |
| `inProgress` | integer |
| `resolved` | integer |
| `asOf` | string |

 제안입니다. total의 취소 포함 여부는 TBD-05/10을 먼저 결정해야 합니다. 쿼리는 없습니다. 목록 필터의 통계인지 행사 전체 통계인지도 A-06에서 결정합니다. 401/403.

### O02 · 내 활동 리포트

```http
GET /api/v1/staff/activity-report
```

인증한 STAFF 본인의 리포트입니다. 관리자 개인 리포트는 기획 미정이므로 `/admin/my-reports`를 확정 목록에 추가하지 않습니다.

쿼리 제안: `period=TODAY|WEEK|ALL`, cursor?,pageSize?. 기본은 TODAY. 200 응답 제안:

**응답 필드**

| 필드 | 타입·허용값 |
|---|---|
| `actor` | object |
| `actor.id` | 상위 모델과 동일 |
| `actor.name` | 상위 모델과 동일 |
| `actor.team` | 상위 모델과 동일 |
| `range` | object |
| `range.from` | string / null |
| `range.to` | string / null |
| `range.timeZone` | string |
| `summary` | object |
| `summary.total` | integer |
| `summary.resolved` | integer |
| `summary.cancelled` | integer |
| `summary.averageProcessingSeconds` | number / null |
| `typeDistribution` | [{type:ReportType,count:integer}] |
| `items` | StaffReport[] |
| `nextCursor` | string / null |
| `asOf` | string |

기간 경계, 접수/완료 중 포함 시각, 비교 수치·재배정 산식은 TBD-10에 의존합니다. 명세를 채택할 때 range가 실제 사용한 구간을 반환하도록 합니다. 요약은 전체 선택 범위 기준이며 현재 페이지만 집계하지 않습니다. 미정 산식을 0으로 대체해 확정 결과처럼 반환하지 않습니다.

평균의 시작·종료는 담당 배정→완료입니다. 단일 배정의 경우 접수 10:00·배정 10:05·완료 10:15이면 600초입니다. 완료 0건의 null 및 소수 반올림은 검토안입니다. 재배정된 건을 제외하거나 최신 claimedAt만 쓰는 정책은 확정하지 않습니다. 401/403/422.

### O03 · 활동 리포트 PDF

```http
GET /api/v1/staff/activity-report/export
```

STAFF 본인, `period=TODAY|WEEK|ALL` 제안입니다. 이 경로와 매체는 PDF 생성 방식을 고른 뒤 채택할 조건부 계약입니다.

- 서버 PDF를 선택하면 200 `application/pdf`, `Content-Disposition: attachment; filename="activity-report.pdf"`. 빈 본문 JSON이나 JSON export를 PDF라고 부르지 않습니다.
- 앱에서 PDF를 만들기로 하면 이 경로 대신 전체 범위 export 데이터 계약을 작성합니다. 페이지 제한 없는 조회의 규모·시간 제한도 함께 정합니다.
- 어느 방식이든 선택 기간 전체 요약과 내역을 사용하며 마지막 페이지 누락이 없어야 합니다. 다른 스태프 데이터는 포함하지 않습니다.
- 생성 시점 스냅샷, 파일 보관·유효기간·다운로드 재시도·장시간 생성의 비동기 전환은 A-07 미정입니다. 401/403/422, 생성 오류의 실제 계약은 방식 선정 후 정의합니다.

### O04 · 접근 경로 조회

```http
GET /api/v1/admin/reports/{reportId}/route
```

같은 행사 ADMIN. `gateId:string` 필수, `mode=WALKING` 제안입니다. 경로 제공자 지원이 확인된 경우에만 채택하며 자동차·임의 안전 경로를 확정하지 않습니다.

200 제안:

**응답 필드**

| 필드 | 타입·허용값 |
|---|---|
| `reportId` | string |
| `gateId` | string |
| `status` | AVAILABLE / NO_ROUTE |
| `geometry` | object / null |
| `geometry.type` | "LineString" |
| `geometry.coordinates` | number[][] |
| `distanceMeters` | number / null |
| `durationSeconds` | number / null |
| `provider` | string / null |
| `generatedAt` | string |

AVAILABLE은 실제 제공자 경로·거리·시간·provider가 non-null, NO_ROUTE는 geometry/거리/시간 null입니다. geometry 좌표는 경도·위도 순서입니다. 응답 없음과 제공자 장애(503)를 구분합니다. 다른 행사 게이트는 404이며 실제 동선 적합성·출발 게이트·도보 지원·캐시·종결 신고 경로 허용은 TBD-09입니다. 제공자 미선정 상태에서 NO_ROUTE 가짜 성공이나 직선을 실제 경로로 반환하지 않습니다.

---

## 응답 모델 사전

> 검토안·미구현. 필드명·타입·null 허용은 기존 v0.1 제안과 같습니다.

#### Actor

| 필드 | 타입·허용값 |
|---|---|
| `id` | string |
| `name` | string |

#### Position

| 필드 | 타입·허용값 |
|---|---|
| `lat` | number[-90,90] |
| `lng` | number[-180,180] |
| `capturedAt` | string |
| `accuracyMeters` | number≥0 또는 null |

#### Classification

| 필드 | 타입·허용값 |
|---|---|
| `value` | 유형 또는 위험도 enum |
| `source` | AI_SUGGESTED / STAFF_EDITED / ADMIN_SELECTED / ADMIN_CONFIRMED |
| `confirmedBy` | Actor 또는 null |
| `confirmedAt` | string 또는 null |

#### ReportCard

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

#### ReportDetail

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

#### StaffReport

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

#### Log

| 필드 | 타입·허용값 |
|---|---|
| `id` | string |
| `action` | string |
| `actor` | Actor |
| `occurredAt` | string |
| `changes` | Change[] |
| `note` | string 또는 null |

#### Change

| 필드 | 타입·허용값 |
|---|---|
| `field` | string |
| `before` | JSON 값 또는 null |
| `after` | JSON 값 또는 null |

#### SupportRequest

| 필드 | 타입·허용값 |
|---|---|
| `id` | string |
| `reportId` | string |
| `openedBy` | Actor |
| `openedAt` | string |
| `closedAt` | string 또는 null |
| `closeReason` | MANUAL / REPORT_RELEASED / REPORT_RESOLVED / REPORT_CANCELLED 또는 null |

#### Participation

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

---

## API 검증·결정 목록

> 상태: 검토안. 문서 검토 결과와 실제 API 테스트를 구분합니다. 이번 작업은 코드·ERD 구현을 포함하지 않습니다.

### 구현 전 검토 대상

| ID | 제안/미정 | 영향 |
|---|---|---|
| A-01 | 신청과 코드 발급 자원 분리, 신청자 증명·발급/반려·지도 매칭 정책 미정(TBD-01·02) | E01·E02·E05 |
| A-02 | Bearer 시작안, 관리자 자격·동일인 복구·만료/갱신·로그아웃 미정(TBD-01·04) | E03·E04·전체 권한 |
| A-03 | 비동기 분석+폴링, 파일/문자 제한·TTL·실패 대안 미정(TBD-06) | I01~04 |
| A-04 | 멱등 키 범위·처리중 응답 제안, 보관 기간·실패 재시도·세션 만료 복구 미정 | 모든 변경·오프라인 |
| A-05 | report.version 통합 경합 제어·지원 요청/참여별 ID, 지원 자동 정리 제안(TBD-07) | R07~16 |
| A-06 | cursor·20/100·동률 정렬·필터 우선·지도 페이지 수신 제안, 임계 변경·통계 대상 미정(TBD-05·11) | R01~06·O01 |
| A-07 | 리포트 기간·재배정·메모 공개·PDF 방식 미정(TBD-10) | StaffReport·O02·O03 |
| A-08 | 정상 GPS만 표현, GPS 실패/오차/구역 밖 미정(TBD-03·06), 경로 미검증(TBD-09) | I03·O04 |
| A-09 | 접두사·UUID/시각·null·새 업무 코드·미등록 필드 거절 제안 | 전체 계약·공통 핸들러 후속 확장 |

API 영문 enum·필드명이 기획 확정을 대신하지 않습니다. 고정된 ‘최대 지원 인원’이나 ‘자동 긴급 승격’을 추가하지 않았습니다. 동시성 제안을 채택하더라도 담당 권한·취소 권한 자체는 PRD 확정 기준을 따릅니다.

### 인수 조건 연결

| 사례 | 기획 근거 | API 검증할 결과 |
|---|---|---|
| 준비 데이터로 행사 진입 | AC-E01~04 | E01에 zones/gates 입력 없음, E05 해당 행사 구역, 팀→구역 매핑 없음 |
| 분석과 접수 분리 | AC-I01~03 | I01/I02 후 신고 0건, I03 성공 후 1건, 원문·최초 제안 유지 |
| 최종 전송 응답 유실 | AC-I05 | 같은 키 재시도 시 같은 신고 ID·상태 코드, 별도 분석 재사용도 중복 생성 금지 |
| 관리자 지도 신고 | AC-I06 | MAP_SELECTED·RECEIVED·담당 없음 |
| 동시 담당 배정 | AC-L01~02 | R07 한 명 성공, 실패자의 분류·확정 이력 미반영 |
| 권한 차이 | AC-L03~06 | 타 담당 완료/해제 403, 타 관리자 취소 가능, 빈 사유 422, 메모 없이 완료 가능 |
| 해제와 미확인 | AC-C01~03 | 최초 createdAt 보존, 임계 초과 접수 복귀 즉시 true |
| 세 가지 취소 | AC-L04~05·07·09 | R10 접수 복귀 / R11 종결·기록 유지 / R16 본인 참여만 종료 |
| 지원 종료 후 재요청 | AC-L08 | 새 requestId, 활성 참여 0, 과거 참여 자동 복구 없음 |
| 참여 취소 후 재참여 | AC-L07 | 새 participationId, 이전 취소 재전송이 새 참여를 변경하지 않음 |
| 행사/스태프 격리 | AC-E02·R01 | 타 행사/타 스태프 자원 404, 입력 actor/event 위조 무효 |
| 목록·지도 | AC-C04~05 | 취소 핀 제거, 다음 페이지 로딩, 낮은 version으로 상태 되돌림 없음 |
| 처리시간 | AC-R03 | 단일 배정 10:05~10:15=600초, 재배정 산식은 TBD |
| 오류·문서 연결 | 기존 공통 규칙 | 상태/code/필드 camelCase 일치, 미구현 422 변환을 구현된 것으로 표시하지 않음 |

지원 정리·기간 산식·GPS 실패 등 조건부 행위는 먼저 정책을 채택한 뒤 테스트 기대값을 확정합니다. 문서 속 예시 응답을 mock으로 반환한 결과는 실제 동시성·접수·AI·지도 기능 검증이 아닙니다.

### 검토 후 순서

공통 요청/응답과 인증 경계를 먼저 합의한 후, 분석·접수와 담당·취소·지원의 핵심 계약을 고정합니다. 화면에 필요한 모델을 확정한 뒤 FastAPI 스키마·OpenAPI·계약 테스트·프론트 호출을 연결합니다. ERD는 저장 무결성·이력·멱등성 보관에 필요한 내용을 별도 설계하며 이번 공개 모델을 그대로 테이블로 복사하지 않습니다.
