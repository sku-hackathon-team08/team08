# 해커톤 백엔드 API

> 상태: 2026-09-11 사용자 정책별 확인을 반영한 현재 구현 계약. 이전 [v0.1 검토안](festival.md)의 미정·조건부 항목 중 아래 범위를 대체합니다. 제품 동작의 기준은 [기능 명세](../features/index.md), 저장은 [DB 계약](../db/storage.md), AI는 [OpenAI 연동](../integrations/openai.md)입니다.

## 범위

- E03·E04·E05, I01~I04, R01~R16, O01~O03과 로그아웃을 구현합니다.
- E01·E02 행사 신청·발급은 이번 범위에서 제외합니다. 준비된 서울 콘서트 행사를 운영 명령으로 등록하고 공통 코드 `DEMO26`으로 진입합니다.
- O04 접근 경로와 #46 GPS 조사는 사용자 결정으로 제외합니다. 경로 API를 가짜 성공으로 제공하지 않습니다.
- 구역 판정도 사용하지 않습니다. 모든 신고의 `zone`은 null입니다. 공개 지도 seed의 가상 구역·게이트는 신고 구역 판정 결과가 아닙니다.
- 실제 브라우저·앱 화면 구현과 기기 검증은 #64의 별도 클라이언트 작업입니다.

## 공통

`/api/v1` 접두사, JSON·쿼리 camelCase, UUID 자원 ID, UTC 밀리초 시각, 모델 직접 반환을 사용합니다. `/health`와 공개 데모 지도는 기존 경로를 유지합니다.

- 요청 JSON 모델은 미등록 키를 거절합니다. JSON 숫자/boolean을 문자열에서 대체 입력하지 않습니다. 이름·텍스트는 공백만으로 전송할 수 없습니다.
- 새 제품 API는 중복 JSON 키, 미등록/중복 쿼리를 422로 거절합니다. 단일 multipart 필드는 중복을 허용하지 않습니다.
- JSON 요청의 실제 제한은 텍스트 분석 5,000자, 음성 10MiB입니다. 전체 생성·변경 HTTP 본문은 11MiB를 넘으면 413입니다.
- 오류는 `status,code,detail,errors`이며 요청 검증은 [422 계약](errors.md#입력-검증-오류)을 따릅니다. 내부 오류·제공자 오류·키를 노출하지 않습니다.
- 권한 없는 역할은 403, 다른 행사/다른 스태프 소유 자원은 404, 세션 누락/무효/로그아웃은 401입니다.
- 생성 멱등성은 I01·I03·I04·R12·R15에 적용합니다. `Idempotency-Key`는 소문자 하이픈 포함 UUIDv4 한 개입니다. 인증·접근·입력 검증 후 행사+actor+실제 경로+키로 저장합니다.
- 동일 입력·성공/확정 업무 실패는 원래 결과를 반환합니다. 다른 입력은 `IDEMPOTENCY_CONFLICT`, 처리중/서버 중단으로 불명인 결과는 `REQUEST_IN_PROGRESS`입니다. 기록의 시간 만료·자동 재시도는 없습니다.
- PATCH에는 키를 적용하지 않습니다. 필수 `expectedVersion`(정수 ≥1)으로 한 변경만 성공하며, 충돌은 `STALE_VERSION`입니다. 같은 버전의 병행 변경에서도 실패한 요청의 분류·이력이 남지 않습니다.
- OpenAPI `/openapi.json`과 `/docs`에서 현재 요청·응답 스키마를 확인합니다. 일반 HTTP 오류와 업무 오류는 별도 스키마이며 공통 형식은 같습니다.

## 진입·세션·지도

| Method | 경로 | 요청 / 결과 |
|---|---|---|
| POST | `/sessions` | `{eventCode,role,name,team?}` → 201 SessionCreated |
| GET | `/sessions/me` | 인증 본인 → 200 SessionInfo, token 제외 |
| DELETE | `/sessions/me` | 현재 토큰 폐기 → 204 |
| GET | `/events/current/map` | 세션 행사에 연결된 지도 → 200 DemoMapResponse |

- `role`은 ADMIN/STAFF. 해커톤은 공통 행사 코드와 진입 화면의 역할 선택을 사용하며 별도 관리자 자격 증명을 요구하지 않습니다.
- STAFF는 `team` 필수, ADMIN은 team을 보내지 않습니다. 이름·팀은 최대 100자입니다.
- 세션은 무작위 Bearer 토큰이며 서버에는 SHA-256 해시만 저장합니다. `expiresAt`은 null이고 로그아웃 전까지 유지합니다. 같은 토큰으로 재접속하면 actor를 유지하며 새 진입은 같은 이름이어도 새 actor입니다.
- 클라이언트는 토큰을 기기에 저장하고 이후 `Authorization: Bearer ...`를 보냅니다. 세션 생성은 멱등 복구를 적용하지 않으며 응답 유실 시 새 진입은 새 사용자입니다. 개인 복구/다중 기기 계정은 범위 밖입니다.
- 준비되지 않은 지도는 409 `MAP_NOT_READY`. 지도 응답에는 모델·고정 데모 위치·가상 구역/게이트와 `DEMO_DRAFT_NOT_SURVEYED` 표시를 포함합니다. 실제 측량/이동 경로로 간주하지 않습니다.

```json
{"eventCode":"DEMO26","role":"STAFF","name":"김스태프","team":"운영팀"}
```

## 분석·최종 접수

| Method | 경로 | 요청 / 결과 |
|---|---|---|
| POST | `/report-analyses` | TEXT JSON 또는 VOICE multipart → 202 `{id,status:"PENDING"}` + Location |
| GET | `/report-analyses/{analysisId}` | 본인 분석 → AnalysisView |
| POST | `/staff/reports` | StaffIntake → 201 StaffReport + Location |
| POST | `/admin/reports` | AdminIntake → 201 ReportDetail + Location |

텍스트 분석은 `{inputMethod:"TEXT",text}`. 음성은 `inputMethod=VOICE`와 audio 파일 한 개입니다. 관리자는 TEXT만 허용합니다. 음성 지원 MIME·제공자 매핑은 [연동 계약](../integrations/openai.md)에 있습니다.

분석 상태는 PENDING→PROCESSING→READY/FAILED. READY에서만 원문·제안 내용·유형·위험도를 반환합니다. 실패는 안전한 failureCode로 안내하며 실패 분석으로 접수할 수 없습니다. 사용자가 새 키로 분석을 재시도합니다. 시간 만료는 없고 분석 하나는 신고 하나에만 사용됩니다. 서버 시작 때 중단된 분석은 `ANALYSIS_INTERRUPTED`로 실패 처리하며 자동 재실행하지 않습니다.

```json
{
  "analysisId":"89b72348-600e-4a27-b2b9-e9e6286f2558",
  "contentFinal":"출입구에 사람이 몰려 있습니다.",
  "type":"CROWD",
  "urgency":"CAUTION",
  "position":{"lat":37.5683536,"lng":126.8970733,"capturedAt":"2026-09-11T01:00:00.000Z","accuracyMeters":null}
}
```

위는 스태프 접수입니다. 관리자는 `urgency` 없이 지도 선택 위치를 보내며 분석 제안 위험도를 사용합니다. 스태프 위치는 서버가 고정 좌표로 덮어쓰고 `DEMO_FIXED`·accuracyMeters=null을 기록합니다. 관리자는 `MAP_SELECTED`이며 선택 좌표를 저장합니다. 양쪽 모두 zone=null입니다.

접수 시 분석 소유자/행사·READY·미사용을 확인합니다. 원문·최초 AI 제안은 분석에 보존하고 최종 내용과 분류를 별도로 저장합니다. STAFF 수정 출처, 관리자 선택 출처를 구분하며 담당자는 아직 없습니다. 같은 분석을 다른 키로 다시 접수하면 `ANALYSIS_ALREADY_USED`입니다.

유형은 EMERGENCY/FACILITY/CROWD/LOST/OTHER, 위험도는 NORMAL/CAUTION/URGENT입니다. 관리자 확인 전 type·urgency의 confirmedBy/confirmedAt은 null입니다.

## 신고 조회·처리

| Method | 경로 | 결과 |
|---|---|---|
| GET | `/staff/reports` | 본인 Page<StaffReport>, 취소 포함 |
| GET | `/staff/reports/{reportId}` | 본인 StaffReport |
| GET | `/admin/reports` | 행사 Page<ReportCard>, 취소 제외 |
| GET | `/admin/reports/{reportId}` | 행사 ReportDetail, 취소도 조회 가능 |
| GET | `/admin/map-reports` | Page<MapPin>, 다음 커서까지 조회 필요 |
| GET | `/admin/reports/{reportId}/logs` | Page<Log>, 과거 이력 유지 |
| PATCH | `/admin/reports/{reportId}/claim` | expectedVersion·type·urgency → 담당 배정과 분류 확인 |
| PATCH | `/admin/reports/{reportId}/classification` | expectedVersion·type?/urgency? → 현재 담당자 수정 |
| PATCH | `/admin/reports/{reportId}/resolve` | expectedVersion·resolveNote? → 완료 |
| PATCH | `/admin/reports/{reportId}/release` | expectedVersion → 담당 해제·접수 복귀 |
| PATCH | `/admin/reports/{reportId}/cancel` | expectedVersion·cancelReason → 사유 필수 취소 |

모든 PATCH 성공은 200 ReportDetail과 증가한 version입니다. 완료·해제·분류 수정은 현재 담당자만, 신고 취소는 같은 행사 관리자 누구나 가능합니다. 종결 후 재변경은 불가합니다. claim은 값이 같아도 ADMIN_CONFIRMED로 남깁니다. classification은 한 필드 이상, 명시적 null은 거절합니다. 완료 메모의 생략/null/공백은 null로 저장합니다. 완료·취소는 기존 담당 정보를 유지하고 release만 현재 담당·claimedAt을 비웁니다.

목록은 `{items,nextCursor,asOf}`이며 기본 pageSize=20, 최대100입니다. 커서는 행위자·경로·필터·정렬에 묶여 다른 조건에서 재사용하면 422입니다. 서버 재시작 뒤 기존 커서는 422가 될 수 있으므로 첫 페이지를 새로 조회합니다. 페이지 사이 상태 변경의 완전한 스냅샷을 보장하지 않으며 ID 중복 제거·첫 페이지 갱신이 필요합니다.

필터 `types`·`statuses`는 쉼표 구분 enum이며 빈 값/알 수 없는 값은 422입니다. 관리자 목록의 CANCELLED 필터도 거절합니다. 관리자 정렬은 `sort=recent|urgency`, 기본 recent입니다. 필터를 먼저 적용한 뒤 미확인 우선, 그다음 위험도순(선택 시)·접수 시각 내림차순·ID 내림차순입니다. 스태프는 최근순, 로그는 발생 시각·ID 오름차순입니다.

미확인은 RECEIVED에서 현재 위험도 기준 3/10/30분을 최초 접수 시각부터 **초과**할 때입니다. 해제 후에도 최초 시각을 유지하며 자동 위험도 승격은 없습니다. 낮은 version 응답으로 화면을 되돌리지 않고 동일 version은 최신 asOf를 적용합니다.

## 지원

모든 경로는 `/admin/reports/{reportId}/support-requests` 아래입니다.

| Method | 하위 경로 | 입력 / 결과 |
|---|---|---|
| POST | 없음 | 담당자 expectedVersion → 201 `{supportRequest,reportVersion}` |
| PATCH | `/{requestId}/close` | 담당자 expectedVersion → 200 같은 결과 |
| GET | `/{requestId}/participants` | 과거 참여 포함 Page<ParticipationView> |
| POST | `/{requestId}/participants` | 다른 관리자 expectedVersion → 201 `{participation,reportVersion}` |
| PATCH | `/{requestId}/participants/{participationId}/cancel` | 본인 expectedVersion → 200 같은 결과 |

활성 요청 하나·관리자별 활성 참여 하나이며 인원 상한은 없습니다. 담당자의 자기 지원·중복 참여·종료된 요청 참여는 거절합니다. 참여 취소 후 재참여에는 새 ID가 생겨 과거 취소 요청이 새 참여를 끝내지 않습니다. 부모 ID 불일치는 404입니다.

지원 수동 종료 또는 신고 완료·취소·담당 해제는 활성 요청과 참여를 같은 트랜잭션에서 모두 종료합니다. 후속 요청에 기존 참여자가 자동 복귀하지 않습니다. 자동 종료는 REPORT_RESOLVED/REPORT_CANCELLED/REPORT_RELEASED, 수동 종료는 MANUAL, 참여 종료는 REQUEST_CLOSED 또는 SELF_CANCELLED입니다.

## 통계·PDF

| Method | 경로 | 요청 / 결과 |
|---|---|---|
| GET | `/admin/stats` | 행사 전체 DashboardStats, 필터 없음 |
| GET | `/staff/activity-report` | period=TODAY/WEEK/ALL·cursor?·pageSize? → ActivityReport |
| GET | `/staff/activity-report/export` | period=TODAY/WEEK/ALL → application/pdf |

관제 total에는 취소도 포함합니다. 개인 리포트도 취소 기록을 보존합니다. 기간 기본 TODAY, 한국 시간 자정·월요일 시작 주간·접수일 기준 `[from,to)`를 사용하며 ALL은 경계 null입니다. 평균은 최종 배정→완료, 완료·배정 시각이 있는 완료 건만 집계하고 0건은 null입니다. API는 초 단위 평균 원값을 반환합니다.

개인 리포트는 자신의 신고만 집계하고 관리자 내부 메모·취소 사유는 포함하지 않습니다. 전체 기간 요약·유형 분포는 현재 페이지에 제한되지 않습니다. PDF는 선택 기간의 전체 내역을 읽어 즉시 생성하며 저장 파일/다운로드 토큰을 만들지 않습니다. 응답은 attachment·Cache-Control:no-store이며 재다운로드는 당시 데이터로 다시 생성합니다. 서버 PDF 생성은 스레드에서 실행하지만 대규모 부하/무제한 내역의 성능은 미검증입니다.

## 실행 경계

- DB 변경은 Alembic으로 명시 실행하며 앱 시작이 테이블을 자동 생성하지 않습니다.
- 분석 중단 복구는 단일 Uvicorn 워커/인스턴스를 전제로 합니다. 여러 프로세스에서 시작 복구를 함께 실행하는 구성은 지원하지 않습니다.
- 브라우저 토큰 저장·화면 전환·실기기 녹음·오프라인 큐는 클라이언트 작업입니다. CORS 기본 origin은 localhost/127.0.0.1:5173이며 배포 origin은 CORS_ORIGINS로 설정합니다.
- 개인정보 자동 삭제·세션의 장기 운영 수명·분석 자동 복구·실시간 스트리밍·접근 경로는 이번 구현에 포함하지 않습니다.
