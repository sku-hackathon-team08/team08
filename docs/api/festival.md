# 축제 서비스 API 명세 v0.1

> 상태: **공통 표현·재전송 확정, 기능별 계약 검토안·미구현** · 2026-09-11 · 기준: [PRD v1.2](../prd/index.md).
> 멱등 키의 생성 요청 우선 적용과 최소 재전송 정책은 2026-09-11 사용자 선택으로 확정했습니다. 공통 표현·422 항목도 같은 날 추천안으로 확정했습니다. 기능별 경로·필드·인증·업무 오류·동시성 세부 방식은 검토안입니다. 제품 확정과 API 계약 확정을 구분합니다. 기존 [네이밍](naming.md)·[공통 오류](errors.md)의 확정 사항은 유지합니다.

## 문서 안내

- 이 문서 하나에서 전체 API를 리뷰할 수 있음
- 목차 링크는 모두 같은 문서 안에서 이동함

- 처음 보는 경우: 아래 **API 목록**에서 필요한 기능을 선택함
- 프론트 데이터 모델: [응답 DTO](#응답-모델-사전) · [요청 DTO](#프론트-요청-dto) · [API별 타입 연결](#api별-타입-연결)
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

- 어떤 조회도 담당을 배정하지 않음
- 구역·게이트 고객 편집, 긴급 롱프레스 즉시 접수, 신고 물리 삭제, 자동 위험도 승격 API는 정의하지 않음

## 작성 범위

- 전체 29개 작업의 요청·응답·권한·실패 조건을 작성했습니다
- 행사 신청·세션, 집계·PDF·경로는 미정 의존성을 명시했습니다
- ERD·마이그레이션·외부 제공자 계약·앱 방식은 변경하지 않음
- 아래에서 제시한 자원은 공개 API 표현이며 테이블과 일대일 대응할 필요가 없음

---

## 공통 모델·요청 규칙

> 부분 확정·미구현. 멱등 키 적용 범위·최소 재전송 정책은 아래 확정 내용을 따르며 공통 표현·422 항목도 확정했습니다. 역할·목록·업무 동시성의 상세 제안은 별도 검토 대상입니다. 기존 `/health` 계약은 변경하지 않습니다.

### 표현 규칙

> #50 계약 확정·미구현 · 2026-09-11 사용자 추천안 채택. 축제 API에 적용하며 기능별 미정 정책은 별도로 유지합니다.

| 항목 | 규칙 | 상태 |
|---|---|---|
| 기본 경로 | `/api/v1` | 확정 |
| 필드명 | JSON·쿼리 `camelCase`; 외부 snake_case 대체 입력 불가 | 확정 |
| 콘텐츠 유형 | JSON: `application/json`, 음성: `multipart/form-data` | 확정 |
| ID·시각 | 자원 ID는 하이픈 포함 UUID 문자열 / 시각은 UTC RFC 3339 문자열 | 확정 |
| 단위 | 초·미터를 필드명에 명시 | 확정 |
| 응답 필드 | 별도 표시가 없으면 항상 존재 | 확정 |
| 선택·빈 값 | `?`: 생략 가능, `null`: 명시적 빈 값, 빈 목록: `[]` | 확정 |
| 성공 본문 | 모델 직접 반환; `{data: ...}` 래퍼 없음 | 확정 |
| 204 | 본문 없음 | 적용 시 준수 |
| 미등록 입력 | 거절; 서버 소유자·역할·상태·구역·이력·출처 덮어쓰기 불가 | 확정 |
| 필수 문자열 | 공백만 있는 문자열은 422. 원문·비밀 값은 자동 trim하지 않고 필드별 정규화를 명시 | 확정 |
| 길이·파일 상한 | 수치 미정 | A-03 |

#### 표현의 세부 기준

- 자원 ID는 숫자로 변환하지 않습니다. 서버 생성 UUID는 [DB 가이드](../guides/database.md)의 UUIDv4 결정을 따르고 응답은 소문자 하이픈 표기로 통일합니다. 입력 UUID는 대소문자를 허용하되 하이픈 형식만 받습니다. 행사 코드·토큰·커서·제공자 버전은 UUID로 강제하지 않습니다.
- 날짜는 유효한 `YYYY-MM-DD`, 시각 입력은 시간대가 있는 RFC 3339로 받고 UTC로 변환합니다. 응답은 `2026-09-11T01:02:03.123Z`처럼 밀리초 3자리 UTC로 통일합니다. 시간대 없는 시각과 `-00:00`(오프셋 불명)은 422입니다. 날짜를 임의로 자정 시각으로 바꾸지 않으며 운영일·집계 경계는 #51·#61에서 결정합니다.
- `?`만 생략 가능하며 nullable 표기가 없는 필드의 `null`은 422입니다. PATCH에서 생략은 유지, 명시적 null은 해당 필드가 삭제를 허용한다고 명세한 경우만 삭제입니다. 액션 PATCH의 필수 `expectedVersion`을 생략 가능하게 만들지 않습니다. 빈 문자열·배열은 null과 다르며 배열은 필드별 최소 개수를 따릅니다.
- 미등록 JSON 키(중첩 포함)·쿼리·multipart 필드는 422로 거절합니다. 일반 HTTP 헤더 전체를 허용 목록으로 제한하지 않습니다. 선언된 단일 쿼리·multipart 필드의 중복 전송과 JSON 객체의 중복 키도 422입니다. 임의 키를 받는 사전은 명시한 경우만 예외입니다.
- JSON 숫자·boolean을 문자열에서 자동 변환하지 않습니다. 쿼리·multipart 문자열은 선언된 타입으로 검증합니다. 필수 텍스트는 공백만인지 검사하되 원문은 보존합니다. 코드·토큰·멱등 키의 공백을 자동 제거하거나 대소문자를 임의 보정하지 않습니다.
- 성공은 기능별 200·201·202와 선언한 모델을 직접 반환합니다. 202는 작업 접수이며 작업 완료가 아닙니다. 목록의 `items`는 목록 모델의 필드이고 전역 래퍼가 아닙니다. PDF는 O03의 조건부 계약, `/health`는 기존 계약을 따릅니다.
- 필드 오류는 [422 항목 계약](errors.md#입력-검증-오류)을 참조합니다. 요청 위치는 별도 값, 중첩 경로는 문자열·배열 인덱스의 배열로 표현합니다.

시간 표기 근거는 [RFC 3339 §5.6](https://www.rfc-editor.org/rfc/rfc3339.html#section-5.6), 202·204의 의미는 [RFC 9110 §15.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3)입니다. UUID 입력 형식·시각 정밀도·멱등 키 정책은 팀이 채택한 규칙이며 RFC가 정한 의무로 표시하지 않습니다.

### 역할·인증

- Bearer 세션을 시작안으로 제안함
- 세션은 행사·역할·행위자 한 명에 귀속함
- 서버는 이 값에서 조회 범위·변경자를 결정함
- 클라이언트의 eventId/adminId로 다른 행사·사용자를 선택하지 않음

- 세션 생성의 관리자 자격 검증·토큰 만료/갱신·로그아웃과 앱 저장 방식은 미정
- 코드와 이름만 알고 있다고 관리자 자격이 검증된 것으로 간주하지 않음
- event-entry의 세션 API는 자격 정책을 확정해야 구현 가능

- 인증 없음/무효는 401, 같은 행사에서 역할 부족은 403, 다른 행사 또는 다른 스태프 소유 자원은 존재를 노출하지 않는 404 제안
- 관리자 상세는 같은 행사 취소 신고도 읽을 수 있음
- 모든 변경·재전송 응답 복구에서도 현재 자원 접근 권한을 검사함

### 응답 모델

필드별 타입은 [응답 모델 사전](#응답-모델-사전)에서 확인합니다.

### 목록

- 페이지 목록은 `{items:T[], nextCursor:string|null, asOf:string}`
- `cursor?`는 불투명 문자열, `pageSize?`는 정수 기본 20·최대 100 제안
- 경계 초과·잘못된 커서는 422
- 커서는 행사·행위자·필터·정렬에 귀속하고 다른 조건으로 재사용하면 422

- 완전한 시점 스냅샷은 보장하지 않는 시작안
- 클라이언트는 ID로 중복 제거하고 첫 페이지를 새로고침함
- 상태가 바뀌는 목록에서 페이지 사이 누락이 생길 수 있으며 영구 누락처럼 유지하지 않도록 새로고침함
- 원문·이력 전체를 목록에 포함하지 않음

### 재전송·동시성

#### 키와 동일 요청의 범위

> #50 최소 재전송 정책 확정·미구현 · 2026-09-11 사용자 요청. 자동 재시도·시간 만료·실패 작업 자동 복구 없이 시작합니다. E01·E03 사전 인증 경계는 #51과 결정합니다.

멱등 키는 생성 요청부터 적용합니다. 적용 대상의 키는 클라이언트가 사용자 동작마다 생성하고 같은 동작의 재전송에서 유지합니다.

| API | 멱등 키 적용 범위 · 확정 |
|---|---|
| I01 분석 생성, I03·I04 신고 접수 | `Idempotency-Key` 필수 |
| R12 지원요청 생성, R15 지원 참여 생성 | `Idempotency-Key` 필수. `expectedVersion`도 함께 사용 |
| R07~R11·R13·R16 PATCH | 멱등 키 적용 안 함. `expectedVersion` 검사와 GET 재조회로 결과 확인 |
| E01 행사 신청, E03 세션 생성 | 생성 요청 적용 방향이나 #51에서 사전 인증 주체·복구 수단을 정한 뒤 확정할 조건부 대상 |
| GET | 멱등 키 적용 안 함 |

PATCH에 키가 전송돼도 멱등 결과를 저장·복구하지 않습니다. 추가 헤더 자체를 오류로 만들지는 않으며 클라이언트도 키를 보내지 않습니다. 키를 적용하지 않는 요청은 아래 키 충돌·결과 보관 규칙의 대상이 아닙니다.

- 클라이언트는 처음 전송하기 전에 UUIDv4 키와 요청 내용을 보존합니다. 응답이 없으면 같은 키·내용으로 수동 재시도하고, 앱 재시작 후에도 유지합니다. 입력 수정·새 동작에는 새 키를 사용하되 이전 요청의 결과가 불명확하면 새 생성부터 하지 않습니다.
- `Idempotency-Key` 헤더는 하나이며 소문자 하이픈 포함 UUIDv4입니다. 누락·형식 오류·복수 값은 기존 `422 VALIDATION_ERROR`로 거절합니다. 필드별 오류 표현은 [422 계약](errors.md#입력-검증-오류)을 따릅니다.
- 서버는 `(행사, 인증한 actor, POST 경로의 실제 자원 ID, 키)`로 구별합니다. 이름·팀·토큰 문자열을 동일인 판단에 쓰지 않습니다.
- JSON은 객체 키 순서·구문 공백을 제외한 값을 비교합니다. 배열 순서·문자열 내용·타입·생략/null은 구분하고 동등한 JSON 숫자는 동일하게 취급합니다. multipart는 필드 값·파일 바이트·파일 MIME을 비교하며 boundary·part 순서·파일명은 제외합니다. 허용 쿼리가 있으면 비교에 포함합니다.

#### 현재 구조에서의 필요성과 대안

생성 요청은 응답 유실로 같은 동작이 두 번 등록되지 않게 키를 사용합니다. 신고의 analysisId 1회 사용 제약도 유지합니다. PATCH는 `expectedVersion`으로 중복 변경을 막고 응답 유실·버전 충돌 시 GET으로 현재 상태를 확인합니다. 최신 버전으로 바꿔 자동 재전송하지 않습니다. 조회로 성공 여부가 불명확하면 확인이 필요하다고 표시합니다.

#### 결과 보관과 재시도

**자동 재시도는 하지 않습니다.** 사용자가 다시 시도할 때 아래 규칙만 적용합니다.

| 같은 범위·키의 상태 | 서버 동작 |
|---|---|
| 처음 받은 유효한 요청 | 한 번만 처리 |
| 같은 내용·성공 완료 | 최초 성공 상태·본문·Content-Type·Location 반환 |
| 다른 내용 | `409 IDEMPOTENCY_CONFLICT`, 실행 안 함 |
| 같은 내용·처리중 또는 결과 불명 | `409 REQUEST_IN_PROGRESS`, 실행 안 함. 화면에 확인 필요 안내 |
| 같은 내용·실패 확정 | 저장한 실패 상태·공통 오류 본문 반환, 다시 실행하지 않음 |

인증·권한·입력 검증을 통과한 요청부터 키를 저장합니다. 그 이전의 거절은 저장하지 않습니다. 저장 후 실패한 요청은 오류 결과를 보관하여 복잡한 재실행 분기를 두지 않습니다. 실패 응답에는 내부 예외·입력 원문을 저장해 노출하지 않습니다. 작업이 반영되지 않았음을 확인한 뒤 사용자가 새로 요청할 때만 새 키를 사용합니다. 서버 오류·네트워크 단절만으로 실패가 확정됐다고 판단하지 않습니다.

키의 중복 선점은 DB 유일성 제약으로 막고, 자원·이력·성공 결과는 같은 트랜잭션에서 확정합니다. I01은 분석 작업 등록과 최초 202 결과를 함께 저장합니다. 재전송은 분석이 완료됐어도 같은 202·ID·Location을 반환하고 현재 상태는 I02로 조회합니다. 외부 AI 호출까지 정확히 한 번 실행됨을 멱등 키만으로 보장하지 않으며 작업 실행은 #56에서 다룹니다.

프로세스 종료 등으로 결과가 불명확하면 자동 재실행하지 않습니다. 사용자는 기존 결과를 조회하고, 확인할 수 없으면 운영 확인으로 넘깁니다. 이 단계에서는 잠금 만료·백오프·실패 작업 자동 복구를 만들지 않습니다.

#### 보관 만료와 세션 만료

MVP에서는 멱등 기록에 **시간 만료·자동 삭제를 두지 않습니다**. 따라서 24시간 경계 처리나 만료 후 새 요청 전환도 없습니다. 결과를 복구할 수 있도록 최초 응답과 키를 DB에 보관합니다. 데이터 보관·삭제 기능을 도입할 때 자원과 멱등 기록의 정리 정책을 함께 정하며, 삭제한 데이터의 복구까지 보장하지 않습니다.

세션이 만료되면 `401 UNAUTHENTICATED`를 반환합니다. 같은 actor로 재인증하고 현재 접근 권한이 확인된 경우에만 저장 결과를 반환합니다. 다른 actor로 재진입하면 이전 생성 요청을 다시 보내지 않습니다. 멱등 키 자체는 인증 수단이 아닙니다. 재인증·동일인 복구 수단은 #51에서 정합니다.

#### 행사·세션 생성 전 경계

| 작업 | 제안하는 주체·행사 범위 | #51과 함께 남은 결정 |
|---|---|---|
| E01 행사 신청 | 서버가 검증한 신청 주체 + 행사 생성 전 전용 범위 | 신청자 증명 발급·재검증·복구 방법. 아직 존재하지 않는 eventId를 요구하지 않음 |
| E03 세션 생성 | 서버가 검증한 진입 시도 주체 + 코드로 서버가 찾은 행사 | 진입 시도 증명 발급·유효기간·동일인 복구. 생성될 actor/token을 선행 입력으로 요구하지 않음 |
| 세션 이후 변경 | 검증한 actor + 세션에 귀속된 행사 | 갱신·재인증에서 actor 유지 여부 |

E01·E03은 **위 식별자 발급·검증 계약이 정해질 때까지 조건부**입니다. 임의의 clientId·멱등 키·행사 코드·이름만으로 신청자 자격이나 토큰 복구 권한을 인정하지 않습니다. 구체 증명 수단은 #51 소유이며 이 문서가 무인증 운영이나 새 인증 API를 채택하지 않습니다. E03 재응답은 원래 토큰이 유효하고 진입 증명을 다시 검증했을 때만 원래 201을 복구합니다. 원래 토큰이 만료·폐기됐다면 401로 거절하고 새 진입 절차를 따릅니다. 재전송으로 토큰 수명을 연장하지 않습니다.

#### 동시성 연결

- 처리 액션은 `expectedVersion:integer≥1`을 요구함
- 버전 불일치는 409 STALE_VERSION으로 거절함
- 업무 상태 변경과 필요한 이력은 함께 성공하거나 함께 실패해야 함
- 멱등 키 적용 POST의 결과 복구는 새 버전 검사보다 먼저 수행하되 인증·접근 권한 검사는 생략하지 않음. PATCH는 저장 결과 복구 없이 버전 검사·재조회 적용

- 보고서의 담당·분류·종결·지원 요청·참여 변경마다 report.version을 증가시키는 단순안을 제안함
- 지원자가 동시에 여러 명 참여하면 일부가 STALE_VERSION을 받을 수 있어 새 상세 조회 후 다시 시도함
- 인원 상한으로 거절하는 것은 아닙니다
- 이 경합 비용은 A-05에서 검토함

- GET 응답의 version이 클라이언트 보유 값보다 낮으면 현재 상태를 되돌리지 않음
- `isUnacknowledged`는 시간만으로 바뀔 수 있으므로 같은 version에서는 asOf가 최신인 조회를 적용함
- 리스트와 지도는 각각의 asOf를 갖고 원자적 스냅샷으로 간주하지 않음

### 오류

- 오류 본문의 목표 형식은 [공통 오류](errors.md)
- 현재 구현은 401·403·409 등의 공통 변환과 422 필드 오류 변환을 제공하지 않음
- 이 문서의 오류는 구현 예정 계약

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

- 인증·자원 범위·입력 구조 검증 → 키/지문 확인·멱등 재응답 → 버전·업무 조건 확인 순서를 적용하는 제안
- 버전과 상태가 모두 다르면 STALE_VERSION을 우선함
- 422는 입력 파싱 단계에서 먼저 발생할 수 있음
- 서버 오류는 500 INTERNAL_SERVER_ERROR, 지원하지 않는 메서드는 기존 405를 따릅니다

```json
{
  "status": 409,
  "code": "STALE_VERSION",
  "detail": "신고 정보가 변경되었습니다. 최신 내용을 확인해주세요.",
  "errors": []
}
```

- 헤더·요청 취소·네트워크 오류를 JSON 업무 오류와 혼동하지 않음
- 타임아웃은 서버 작업 취소를 의미하지 않음
- 오류 보관·재시도 간격은 [결과 보관 검토안](#결과-보관과-재시도), 요청 제한 수치는 후속 결정

---

## 행사·세션·제공자 지도 API

> 검토안·미구현. 기준: [행사 진입](../features/event-entry.md). 공통 접두사·모델·오류는 [공통 규칙](#공통-모델요청-규칙).
> **조건부:** TBD-01·02·04(코드 발급, 자격, 지도 매칭, 앱 방식). 사용자 구역 편집 API는 없습니다.

### E01 · 행사 신청

```http
POST /api/v1/event-applications
```

- **목적:** 행사 신청 생성
- **권한:** 신청자 자격 방식 미정 — 무인증 운영 확정 아님

#### 요청 Body

| 필드 | 타입 | 필수 여부 |
|---|---|---|
| `eventName` | string | 필수 |
| `applicantName` | string | 필수 |
| `venueName` | string | 필수 |
| `startDate` | YYYY-MM-DD | 필수 |
| `endDate` | YYYY-MM-DD | 필수 |

- **검증:** 시작일 ≤ 종료일
- **입력 제외:** `zones`, `gates`, 구역 폴리곤
- **미정:** 장소 데이터 매칭(TBD-02), 날짜에 대응하는 실제 운영 시각

#### 성공 응답 · 201

**Application 필드**

| 필드 | 타입·허용값 |
|---|---|
| `id` | string |
| `status` | PENDING / ISSUED |
| `eventId` | string / null |
| `eventCode` | string / null |

| 신청 상태 | `eventId` · `eventCode` |
|---|---|
| `PENDING` | 둘 다 `null` |
| `ISSUED` | 둘 다 반환 |

- **미정:** 즉시 발급 / 준비 후 발급
- **자동 관리자 로그인:** 제공하지 않는 제안

**오류:** 422 입력 오류, 401/403 신청자 자격 오류(정책 결정 후), 공통 멱등성 오류. 미지원 장소의 반려·재신청은 상태/오류를 임의 확정하지 않고 A-01에서 결정합니다.

### E02 · 행사 신청 조회

```http
GET /api/v1/event-applications/{applicationId}
```

- 신청자 본인만 조회함
- 200 Application. 본인 증명 수단은 A-01 미정이며 ID를 안다는 것만으로 행사 코드를 노출하지 않음
- 401/403/404

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

- 관리자 자격 증명 입력은 아직 정의하지 않았습니다
- 현재 필드만으로 운영 인증을 구현하지 않음

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

- 같은 이름의 동명이인을 자동으로 기존 계정으로 복구하지 않음
- 역할·세션 재진입 동일인 처리와 코드 오류 표시는 A-02에서 결정함
- **오류:** 422, 자격 불충족 401/403, 공통 멱등성 오류. 토큰 생성·만료 길이·발급 재시도 정책은 조건부입니다.

### E04 · 내 세션 조회

```http
GET /api/v1/sessions/me
```

- 인증한 본인의 `role,event,actor,expiresAt`을 200으로 반환함
- token을 재노출하지 않음
- 팀은 소속 표시이며 zoneId 필드는 없음
- 401

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

- Zone: `id:string,name:string,geometry:{type:"Polygon",coordinates:number[][][]}`. 좌표 배열 순서는 `[경도,위도]` 제안
- WGS84 경위도이며 첫/마지막 점은 같아야 함
- 다중 구역 형상 지원은 제공 데이터 검증 후 확장함
- Gate: `id:string,name:string,position:{lat:number,lng:number},zoneId:string|null`.
- 브이월드 타일 자체나 서버 비밀 키를 반환하지 않음
- 클라이언트 지도 SDK·키 정책은 외부 연동 문서의 후속 계약
- 잘못된 행사·준비되지 않은 데이터를 빈 구역 배열로 성공 처리해 준비 완료처럼 보이지 않음
- 준비중 상태의 HTTP/코드는 A-01에서 결정함
- **오류:** 401/404, 실제 동기 제공자 호출 실패는 503. 저장된 구역 조회와 외부 지도 렌더 실패를 같은 오류로 취급하지 않음

### 예시

```json
{
  "eventCode": "DEMO26",
  "role": "STAFF",
  "name": "김스태프",
  "team": "운영팀"
}
```

- 위 코드는 설명용
- 실제 코드 길이·문자 조합의 검증 기준이 아닙니다

---

## 분석·신고 접수 API

> 검토안·미구현. 기준: [입력 흐름](../features/report-intake.md). 공통은 [공통 규칙](#공통-모델요청-규칙).
> GPS 실패·위치 허용 오차·입력/파일 제한·분석 실패 대안은 TBD-03·06입니다. 운영 접수는 정상 GPS 확보 흐름을 기준으로 하며 GPS 실패 때 전송 차단/수동 대체는 미정입니다. 오늘 데모는 [고정 위치 계약](../features/report-intake.md#오늘-데모의-고정-위치)을 적용합니다.

### I01 · 신고 내용 분석

```http
POST /api/v1/report-analyses
```

- 인증한 STAFF/ADMIN이 본인 분석을 생성함
- 최종 신고는 아직 없음
- ADMIN은 TEXT만 사용함

**요청 Body · 텍스트** (`application/json`)

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
- 필수 헤더 Idempotency-Key. 같은 키로 재업로드해도 분석 작업을 중복 실행하지 않음
**오류:** 401/403, 422 빈 텍스트/필드 오류, 413/415 파일 제한, 공통 멱등성 오류.
- 허용 코덱·MIME·파일 크기·녹음 길이·텍스트 길이·분석 보관 기간은 A-03 미정입니다.

### I02 · 분석 결과 조회

```http
GET /api/v1/report-analyses/{analysisId}
```

- 행사·분석 소유자 일치 시 200 Analysis를 반환함
- 다른 행위자 분석은 404. 폴링을 시작안으로 제안하며 주기는 미정

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
- FAILED: 결과 필드는 null, failureCode는 TRANSCRIPTION_FAILED 또는 ANALYSIS_FAILED 제안. 내부 제공자 오류 문자열은 노출하지 않음
- 텍스트의 transcriptRaw는 최초 입력 원문
- 음성은 최초 STT 변환문이며 사용자의 수정 내용과 구분함
- expiresAt은 실제 유효기간을 정한 후 채웁니다
- null은 유효기간 정책 미설정이며 무기한 보존 확정이 아닙니다
- 실패 분석에서 자동으로 ‘기타/주의’ 신고를 만들지 않음
- 수동 전송 허용과 fallback 분류는 미정

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

- analysisId는 같은 행사·본인 소유·READY·유효한 분석이어야 함

#### 성공 응답 · 201

- [StaffReport](#staffreport). 상태 RECEIVED, claimedBy/claimedAt/resolvedAt/cancelledAt=null. createdAt은 서버 최종 접수 시각
- Location은 `/api/v1/staff/reports/{id}`
- 운영에서는 서버가 GPS 입력 경로와 현재 구역을 판정함. 오늘 데모에서는 서버의 데모 설정으로 고정 위치 출처 `DEMO_FIXED`를 기록하고 GPS 실측으로 표시하지 않음. 클라이언트가 임의로 출처를 선택하지 않음
- zoneId·positionSource·reporter·status·createdAt 입력은 거절함
- 최종 type/urgency가 AI 제안과 다르면 STAFF_EDITED, 같으면 AI_SUGGESTED로 기록하는 제안
- 수정했다 원래 값으로 되돌린 UI 과정까지 ‘최종 값 변경’으로 기록하지 않음
- 분석 하나는 최종 신고 하나에만 사용할 수 있는 제안
- 같은 Idempotency-Key 재시도는 최초 201을 복구하고, 다른 키로 재사용하면 409 ANALYSIS_ALREADY_USED
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

- 예시 좌표와 시각은 실제 신고가 아닙니다
- 위치 정확도·유효 시간 기준을 나타내지 않음

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

- 분석은 본인 TEXT/READY여야 함
- urgency 입력은 받지 않고 분석의 위험도 제안을 사용함

#### 성공 응답 · 201

- [ReportDetail](#reportdetail). 상태 RECEIVED, 담당 없음
- type.source=ADMIN_SELECTED, urgency.source=AI_SUGGESTED
- `confirmedBy/confirmedAt`은 null이며 생성이 담당 배정·분류 확정을 대체하지 않음
- positionSource=MAP_SELECTED
- 이후 claim으로 맡아야 함

- 분석 소유권·단일 사용·멱등성·오류는 I03과 같습니다
- 관리자가 편집할 위치의 capturedAt은 지도 선택 시각, accuracyMeters는 null
- 상세 확인 UI의 분석 호출 위치는 화면 연결 시 검토함

### 오프라인 경계

- 음성·텍스트 초안과 전송 대기는 아직 서버 신고가 아닙니다
- READY 분석을 참조한 최종 전송의 응답만 유실되었다면 동일 키로 복구함
- 앱이 오프라인에서 새 분석을 완료했다고 표시하지 않음
- 임시 분석 만료 후 대기 신고 처리, 앱 재설치·세션 만료 후 동일인 복구, 키 보관 기간은 A-02~04에서 결정함

### 최종 접수 성공 응답 예시

- 다음은 I03의 201 StaffReport 예시
- ID·좌표·시각은 설명용

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

- Page는 공통 `{items,nextCursor,asOf}`
- MapPin은 `id,version,position,status,type,urgency,isUnacknowledged`를 ReportCard에서 선택한 모델
- 공통 목록 기본 크기를 쓰되 지도는 다음 커서를 끝까지 조회함
- 첫 페이지를 전체 핀처럼 표시하지 않으며 로딩/부분 수신 상태를 구분함
- 전체 규모·클러스터링은 A-06 미정

- types·statuses는 쉼표로 구분한 enum 목록, 미지정 시 허용값 전체 제안
- 빈 문자열·알 수 없는 값은 422
- R03/R05는 CANCELLED를 제외하고, 명시적 CANCELLED 필터는 422 제안
- R01/R02와 권한 있는 R04/R06에서는 취소 기록을 유지함

- 정렬 제안: 먼저 미확인 우선, recent는 createdAt 내림차순·id 내림차순, urgency는 URGENT→CAUTION→NORMAL·createdAt 내림차순·id 내림차순. 필터가 먼저 대상을 제한하고 그 안에서 미확인 상단을 적용하는 안은 **TBD-05 의존 검토안**
- R01은 createdAt·id 내림차순, R06은 occurredAt·id 오름차순

- isUnacknowledged는 RECEIVED이며 최초 createdAt부터 긴급 3분·주의 10분·일반 30분을 초과했을 때 true
- 버전과 별개로 서버 조회 시각에 계산함
- release로 접수 복귀해도 createdAt은 유지함
- 분류 변경 후 임계 기준은 TBD-05이며 기존 값으로 계산하는 구현을 임의 확정하지 않음

Log.action 제안: REPORT_CREATED, REPORT_CLAIMED, CLASSIFICATION_CHANGED, ASSIGNMENT_RELEASED, REPORT_RESOLVED, REPORT_CANCELLED, SUPPORT_REQUEST_OPENED, SUPPORT_REQUEST_CLOSED, SUPPORT_JOINED, SUPPORT_LEFT. 변경 내역은 허용된 공개 필드만 넣고 내부 토큰·DB 컬럼을 포함하지 않습니다.

조회 오류: 공통 401/403/404, 쿼리 검증 422. 실시간 갱신은 조회 기반 시작안이며 WebSocket·SSE 계약을 확정하지 않습니다.

---

## 신고 담당·완료·취소 API

> 검토안·미구현. 기준: [처리 권한](../features/report-lifecycle.md), [관제](../features/command-dashboard.md). 모델·오류·경합 우선순위는 [공통 규칙](#공통-모델요청-규칙).

### 처리 액션

- 모든 작업은 ADMIN 같은 행사이며 expectedVersion이 필요. 이 절의 R07~R11 PATCH에는 멱등 키를 적용하지 않고 응답 유실 시 상세를 재조회
- 성공은 **200 ReportDetail**이며 변경 후 version을 반환함
- 업무 변경과 이력은 함께 기록함
- 성공 재전송은 최초 결과를 돌려줍니다
- 새 키로 같은 종결 동작을 반복하면 409 INVALID_REPORT_STATE

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

- R07은 값을 수정하지 않아도 두 분류를 관리자 확인으로 남깁니다
- R08은 보낸 필드만 관리자 확인 정보로 갱신하고 생략한 필드는 유지함
- 동시에 claim이 경합하면 한 명만 배정·분류 저장에 성공하며 다른 요청은 409로 최신 조회를 안내함
- 별도 분류 저장을 먼저 호출하지 않음

- R10에서 note를 받지 않는 것은 사유 정책 미정(TBD-07)에 대한 최소 계약 제안
- 사유 입력을 채택하면 선택/필수를 별도로 정의함
- R11은 목록 X·상세 취소가 동일 API를 사용하며 DELETE/hide API는 없음
- 완료·취소 시 기존 담당은 이력 식별을 위해 유지하는 제안

- 오류: 401/403/404/422 및 STALE_VERSION·INVALID_REPORT_STATE. 다른 담당자의 완료/분류/해제는 403
- 신고가 종결된 경우 새 변경은 409
- 권한을 얻지 못한 클라이언트가 ‘지원 참여자’라는 이유로 담당 작업을 수행할 수 없음

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

- 요청과 참여에 각각 ID를 부여함
- 새 요청은 새 ID, 본인 취소 후 재참여도 새 참여 ID
- 과거 참여를 다시 활성화하지 않는 API 제안으로 지연된 취소가 새 참여를 끝내지 못하게 함

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

- R12는 최초 참여자 0명으로 시작함
- 이미 활성 요청이면 새 요청을 만들지 않고 409 INVALID_REPORT_STATE 제안
- R13은 closeReason=MANUAL·closedAt을 기록하고 활성 참여 전부를 REQUEST_CLOSED로 종료함
- report 상태와 담당은 유지함
- 이후 R12는 새 요청을 만듭니다
- R14는 해당 요청의 종료 참여도 반환하는 제안
- 활성 여부는 endedAt=null로 판단함
- 과거 요청 ID는 로그 changes의 supportRequestId로 찾을 수 있음
- R15의 행위자는 세션에서 가져옵니다
- 담당자의 자기 지원과 이미 활성인 본인의 중복 참여는 409 INVALID_REPORT_STATE 제안
- 다른 사람 참여를 추가하는 adminId 입력은 받지 않음
- 인원 수 제한이나 FULL 오류는 없음
- R16은 SELF_CANCELLED·endedAt을 기록하고 다른 참여·신고 담당·지원요청은 유지함
- 재참여는 R15에서 새 participationId로 시작함
- 다른 사람 참여 취소는 403, 이미 끝난 참여 취소는 버전·상태 조건에 따라 409
- R12·R15 POST는 동일 Idempotency-Key 재시도로 원래 201을 복구. R13·R16 PATCH는 키를 적용하지 않고 버전 검사·재조회
- 새 요청이 열린 후 이전 requestId/participationId로 온 변경은 새 요청·참여를 변경하지 않음
- 모든 경로 ID의 부모 reportId/requestId 일치를 검사함
- 불일치는 404
- 성공·실패 모두 원래 담당자·claimedAt을 지원자로 바꾸지 않음
- 오류는 공통 401/403/404/422/409
- reportVersion은 report.version과 같은 값

### 지원과 담당 해제·종결 — 조건부 보완안

- TBD-07에 대해 release/resolve/cancel 시 활성 요청을 함께 닫고 해당 참여를 종료하는 방안을 제안함
- closeReason은 각각 REPORT_RELEASED / REPORT_RESOLVED / REPORT_CANCELLED이며 참여 endReason은 REQUEST_CLOSED
- 신고 변경·요청 종료·참여 종료·이력은 함께 반영함

- 이는 사용자가 확정한 ‘담당자의 수동 지원요청 종료’와 별개인 **미확정 제안**
- 이 정책이 채택되기 전에는 관련 동작의 전체 계약을 구현 승인으로 해석하지 않음
- 어떤 경우에도 종결 뒤 새 지원을 생성하거나 과거 요청이 새 참여를 수정해서는 안 됨

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

- 제안
- total의 취소 포함 여부는 TBD-05/10을 먼저 결정해야 함
- 쿼리는 없음
- 목록 필터의 통계인지 행사 전체 통계인지도 A-06에서 결정함
- 401/403

### O02 · 내 활동 리포트

```http
GET /api/v1/staff/activity-report
```

- 인증한 STAFF 본인의 리포트
- 관리자 개인 리포트는 기획 미정이므로 `/admin/my-reports`를 확정 목록에 추가하지 않음

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

- 기간 경계, 접수/완료 중 포함 시각, 비교 수치·재배정 산식은 TBD-10에 의존함
- 명세를 채택할 때 range가 실제 사용한 구간을 반환하도록 함
- 요약은 전체 선택 범위 기준이며 현재 페이지만 집계하지 않음
- 미정 산식을 0으로 대체해 확정 결과처럼 반환하지 않음

- 평균의 시작·종료는 담당 배정→완료
- 단일 배정의 경우 접수 10:00·배정 10:05·완료 10:15이면 600초
- 완료 0건의 null 및 소수 반올림은 검토안
- 재배정된 건을 제외하거나 최신 claimedAt만 쓰는 정책은 확정하지 않음
- 401/403/422

### O03 · 활동 리포트 PDF

```http
GET /api/v1/staff/activity-report/export
```

- STAFF 본인, `period=TODAY|WEEK|ALL` 제안
- 이 경로와 매체는 PDF 생성 방식을 고른 뒤 채택할 조건부 계약

- 서버 PDF를 선택하면 200 `application/pdf`, `Content-Disposition: attachment; filename="activity-report.pdf"`. 빈 본문 JSON이나 JSON export를 PDF라고 부르지 않음
- 앱에서 PDF를 만들기로 하면 이 경로 대신 전체 범위 export 데이터 계약을 작성함
- 페이지 제한 없는 조회의 규모·시간 제한도 함께 정함
- 어느 방식이든 선택 기간 전체 요약과 내역을 사용하며 마지막 페이지 누락이 없어야 함
- 다른 스태프 데이터는 포함하지 않음
- 생성 시점 스냅샷, 파일 보관·유효기간·다운로드 재시도·장시간 생성의 비동기 전환은 A-07 미정
- 401/403/422, 생성 오류의 실제 계약은 방식 선정 후 정의함

### O04 · 접근 경로 조회

```http
GET /api/v1/admin/reports/{reportId}/route
```

- 같은 행사 ADMIN. `gateId:string` 필수, `mode=WALKING` 제안
- 경로 제공자 지원이 확인된 경우에만 채택하며 자동차·임의 안전 경로를 확정하지 않음

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

- AVAILABLE은 실제 제공자 경로·거리·시간·provider가 non-null, NO_ROUTE는 geometry/거리/시간 null
- geometry 좌표는 경도·위도 순서
- 응답 없음과 제공자 장애(503)를 구분함
- 다른 행사 게이트는 404이며 실제 동선 적합성·출발 게이트·도보 지원·캐시·종결 신고 경로 허용은 TBD-09
- 제공자 미선정 상태에서 NO_ROUTE 가짜 성공이나 직선을 실제 경로로 반환하지 않음

---

## 응답 모델 사전

> 검토안·미구현. 필드명·타입·null 허용은 기존 v0.1 제안과 같습니다.

### 프론트 타입 사용 기준

- **위치:** 이 문서 안에서 요청·응답 타입까지 함께 리뷰
- **용도:** 프론트 참조용 DTO; 아직 런타임 코드에 적용하지 않은 검토안
- **시간·ID:** API 원본 문자열 유지; 화면용 날짜·라벨은 UI에서 변환
- **유효성:** TypeScript 타입만으로 UUID·범위·길이·응답의 런타임 검증을 보장하지 않음
- **미정 정책:** `TBD` 주석 확인; 임의 기본값으로 확정하지 않음
- **모델 경계:** DB 테이블·ERD가 아닌 공개 API 데이터

```ts
export type UUID = string;
export type IsoDateTime = string; // UTC RFC 3339
export type DateOnly = string; // YYYY-MM-DD
export type Role = "STAFF" | "ADMIN";
export type ReportType = "EMERGENCY" | "FACILITY" | "CROWD" | "LOST" | "OTHER";
export type Urgency = "NORMAL" | "CAUTION" | "URGENT";
export type ReportStatus = "RECEIVED" | "IN_PROGRESS" | "RESOLVED" | "CANCELLED";
export type ClassificationSource =
  | "AI_SUGGESTED"
  | "STAFF_EDITED"
  | "ADMIN_SELECTED"
  | "ADMIN_CONFIRMED";
export type JsonValue =
  | string | number | boolean | null
  | JsonValue[] | { [key: string]: JsonValue };

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  asOf: IsoDateTime;
}
export interface PageQuery {
  cursor?: string;
  pageSize?: number; // 기본 20·최대 100 제안
}
export interface VersionRequest {
  expectedVersion: number; // 정수 ≥ 1
}
```

#### Actor

```ts
export interface Actor {
  id: UUID;
  name: string;
}
```

#### Position

```ts
export interface Position {
  lat: number; // -90~90
  lng: number; // -180~180
  capturedAt: IsoDateTime; // 데모에서는 고정 좌표를 요청에 담은 시각이며 GPS 실측 시각 아님
  accuracyMeters: number | null; // 0 이상; 지도 선택은 null
}
```

#### Classification

```ts
export interface Classification<T extends ReportType | Urgency> {
  value: T;
  source: ClassificationSource;
  confirmedBy: Actor | null;
  confirmedAt: IsoDateTime | null;
}
```

#### ReportCard

```ts
export interface ZoneSummary {
  id: UUID;
  name: string;
}
export interface ReportCard {
  id: UUID;
  version: number; // 변경 버전; 정수 ≥ 1
  contentFinal: string;
  type: Classification<ReportType>;
  urgency: Classification<Urgency>;
  status: ReportStatus;
  position: Position;
  positionSource: "GPS" | "MAP_SELECTED" | "DEMO_FIXED"; // DEMO_FIXED는 오늘 데모 전용
  zone: ZoneSummary | null;
  createdAt: IsoDateTime; // 최초 서버 접수 시각; 해제 후에도 유지
  claimedBy: Actor | null;
  claimedAt: IsoDateTime | null; // 현재 배정 시각; 해제 시 null
  isUnacknowledged: boolean;
  supportRequestId: UUID | null;
  activeSupporterCount: number;
}
```

#### ReportDetail

```ts
export interface ReportDetail extends ReportCard {
  reporter: Actor;
  inputMethod: "VOICE" | "TEXT";
  transcriptRaw: string;
  contentSuggested: string;
  typeSuggested: ReportType;
  urgencySuggested: Urgency;
  resolvedAt: IsoDateTime | null;
  resolveNote: string | null;
  cancelledAt: IsoDateTime | null;
  cancelledBy: Actor | null;
  cancelReason: string | null;
}
```

#### StaffReport

```ts
export interface StaffReport {
  id: UUID;
  contentFinal: string;
  type: Classification<ReportType>;
  urgency: Classification<Urgency>;
  status: ReportStatus;
  position: Position;
  zone: ZoneSummary | null;
  createdAt: IsoDateTime;
  claimedBy: Actor | null;
  claimedAt: IsoDateTime | null;
  resolvedAt: IsoDateTime | null;
  cancelledAt: IsoDateTime | null;
  // TBD-10: 관리자 메모·취소 사유 공개 여부. 현재 필드에는 제외.
}
```

#### Log

```ts
export interface Log {
  id: UUID;
  action: string; // 허용 action 제안은 조회 공통 규칙 참조
  actor: Actor;
  occurredAt: IsoDateTime;
  changes: Change[];
  note: string | null;
}
```

#### Change

```ts
export interface Change {
  field: string;
  before: JsonValue;
  after: JsonValue;
}
```

#### SupportRequest

```ts
export interface SupportRequest {
  id: UUID;
  reportId: UUID;
  openedBy: Actor;
  openedAt: IsoDateTime;
  closedAt: IsoDateTime | null;
  closeReason:
    | "MANUAL"
    // TBD-07: 아래 자동 종료 사유는 정책 채택 전 조건부
    | "REPORT_RELEASED" | "REPORT_RESOLVED" | "REPORT_CANCELLED"
    | null;
}
```

#### Participation

```ts
export interface Participation {
  id: UUID;
  supportRequestId: UUID;
  actor: Actor;
  joinedAt: IsoDateTime;
  endedAt: IsoDateTime | null;
  endReason: "SELF_CANCELLED" | "REQUEST_CLOSED" | null;
}
```

- ReportType은 EMERGENCY(긴급), FACILITY(시설), CROWD(혼잡), LOST(미아/분실), OTHER(기타), Urgency는 NORMAL(일반), CAUTION(주의), URGENT(긴급)
- ReportStatus는 RECEIVED / IN_PROGRESS / RESOLVED / CANCELLED
- 영문 값은 API 제안이며 UI의 한국어 기획 의미를 유지함

- 미확인·지원요청은 신고 상태 enum에 추가하지 않음
- 자동 위험도 승격 출처·시각은 이번 모델에 넣지 않음
- 위치 출처는 역할별 접수 경로에서 서버가 결정함
- `confirmedBy`·`confirmedAt`은 관리자 확정/수정에서만 채우며 AI·스태프 단계에는 null

- `createdAt`은 최초 서버 접수 시각이며 변경하지 않음
- `claimedAt`은 현재 배정 시각으로 해제 시 null
- 과거 배정 시각은 이력에 남깁니다
- 재배정 신고의 처리시간은 이 필드 하나로 임의 계산하지 않음

- StaffReport는 내역용 최소 공개 모델
- 관리자 내부 메모·취소 사유 공개 범위는 TBD-10이므로 이 모델에 노출하지 않는 제안
- 확정 후 확장함
- 상세 이력·지원 목록은 무한 배열로 넣지 않고 별도 조회함

---

### 행사·세션 데이터 모델

> 조건부: 신청자 증명·발급·관리자 자격·세션 수명은 A-01·02 미정.

```ts
export type Application =
  | { id: UUID; status: "PENDING"; eventId: null; eventCode: null }
  | { id: UUID; status: "ISSUED"; eventId: UUID; eventCode: string };
export interface Session {
  token: string;
  expiresAt: IsoDateTime;
  role: Role;
  event: { id: UUID; name: string };
  actor: Actor & { team: string | null };
}
export type SessionMe = Omit<Session, "token">;
export interface Zone {
  id: UUID;
  name: string;
  geometry: { type: "Polygon"; coordinates: number[][][] }; // 경도·위도 순서
}
export interface Gate {
  id: UUID;
  name: string;
  position: { lat: number; lng: number };
  zoneId: UUID | null;
}
export interface MapData {
  eventId: UUID;
  dataVersion: string;
  center: { lat: number; lng: number };
  zones: Zone[];
  gates: Gate[];
  asOf: IsoDateTime;
}
```

### 분석 데이터 모델

- `READY` 확인 후에만 결과 필드 사용
- `PENDING`·`PROCESSING`·`FAILED` 결과 필드: `null`
- `expiresAt: null`: TTL 미정; 무기한 보존 보장 아님

```ts
export interface AnalysisCreated {
  id: UUID;
  status: "PENDING";
}
interface AnalysisBase {
  id: UUID;
  expiresAt: IsoDateTime | null;
}
interface EmptyAnalysisResult {
  transcriptRaw: null;
  contentSuggested: null;
  typeSuggested: null;
  urgencySuggested: null;
}
export type Analysis = AnalysisBase & (
  | (EmptyAnalysisResult & {
      status: "PENDING" | "PROCESSING";
      failureCode: null;
    })
  | (EmptyAnalysisResult & {
      status: "FAILED";
      failureCode: "TRANSCRIPTION_FAILED" | "ANALYSIS_FAILED";
    })
  | {
      status: "READY";
      transcriptRaw: string;
      contentSuggested: string;
      typeSuggested: ReportType;
      urgencySuggested: Urgency;
      failureCode: null;
    }
);
```

### 목록·지원 응답 데이터 모델

```ts
export type MapPin = Pick<ReportCard,
  "id" | "version" | "position" | "status" | "type" | "urgency" | "isUnacknowledged"
>;
export interface SupportRequestResult {
  supportRequest: SupportRequest;
  reportVersion: number;
}
export interface ParticipationResult {
  participation: Participation;
  reportVersion: number;
}
```

### 통계·리포트·경로 데이터 모델

> 조건부: 집계 기준·재배정 산식·PDF 방식·경로 제공자 미정. 타입 작성은 기능 확정을 의미하지 않음.

```ts
export interface AdminStats {
  total: number;
  unacknowledged: number;
  inProgress: number;
  resolved: number;
  asOf: IsoDateTime;
}
export interface ActivityReport extends Page<StaffReport> {
  actor: Actor & { team: string | null };
  range: {
    from: IsoDateTime | null;
    to: IsoDateTime | null;
    timeZone: string;
  };
  summary: {
    total: number;
    resolved: number;
    cancelled: number;
    averageProcessingSeconds: number | null;
  };
  typeDistribution: Array<{ type: ReportType; count: number }>;
}
export type RouteResponse = {
  reportId: UUID;
  gateId: UUID;
  generatedAt: IsoDateTime;
} & (
  | {
      status: "AVAILABLE";
      geometry: { type: "LineString"; coordinates: number[][] };
      distanceMeters: number;
      durationSeconds: number;
      provider: string;
    }
  | {
      status: "NO_ROUTE";
      geometry: null;
      distanceMeters: null;
      durationSeconds: null;
      provider: string | null;
    }
);
// 서버가 PDF를 생성하기로 결정한 경우에만 적용
export type ActivityPdf = Blob;
```

### 프론트 요청 DTO

- **Body / Query / Path:** 아래 API별 연결 표에서 구분
- **음성:** `VoiceAnalysisRequest`를 JSON으로 보내지 않고 `FormData`로 변환
- **필터:** `types`·`statuses`는 쉼표 구분 문자열; enum 검증 필요
- **헤더:** 토큰·멱등 키는 Body에 포함하지 않음

```ts
export interface AuthHeaders {
  Authorization: string; // Bearer <token>
}
// I01·I03·I04·R12·R15 생성 요청에만 적용. E01·E03은 #51 조건부.
export interface CreationHeaders {
  "Idempotency-Key": UUID;
}
export interface EventApplicationRequest {
  eventName: string;
  applicantName: string;
  venueName: string;
  startDate: DateOnly;
  endDate: DateOnly;
}
export type SessionRequest = {
  eventCode: string;
  name: string;
} & (
  | { role: "STAFF"; team: string }
  | { role: "ADMIN"; team?: never }
);
export interface TextAnalysisRequest {
  inputMethod: "TEXT";
  text: string;
}
export interface VoiceAnalysisRequest {
  inputMethod: "VOICE";
  audio: Blob; // multipart 파일 한 개; 코덱·크기는 TBD
}
export type AnalysisRequest = TextAnalysisRequest | VoiceAnalysisRequest;
export interface StaffReportRequest {
  analysisId: UUID;
  contentFinal: string;
  type: ReportType;
  urgency: Urgency;
  position: Position;
}
export type AdminReportRequest = Omit<StaffReportRequest, "urgency">;
export interface ClaimRequest extends VersionRequest {
  type: ReportType;
  urgency: Urgency;
}
export type ClassificationRequest = VersionRequest & (
  | { type: ReportType; urgency?: Urgency }
  | { type?: ReportType; urgency: Urgency }
);
export interface ResolveRequest extends VersionRequest {
  resolveNote?: string | null;
}
export interface CancelReportRequest extends VersionRequest {
  cancelReason: string; // trim 후 빈 문자열 불가
}
export interface ReportFilterQuery extends PageQuery {
  types?: string; // 예: "CROWD,FACILITY"
  statuses?: string; // RECEIVED,IN_PROGRESS,RESOLVED만 허용하는 제안
}
export interface AdminReportQuery extends ReportFilterQuery {
  sort?: "recent" | "urgency";
}
export interface ActivityPeriodQuery {
  period?: "TODAY" | "WEEK" | "ALL"; // O02 기본 TODAY; 나머지 기본값 TBD
}
export type ActivityReportQuery = PageQuery & ActivityPeriodQuery;
export interface RouteQuery {
  gateId: UUID;
  mode?: "WALKING";
}
```

### 오류 데이터 모델

- **목표 형식:** 아래 `ApiError`
- **현재 구현:** 일부 상태만 공통 형식 적용; 422는 FastAPI 기본 응답
- **확정 계약:** [422 항목 구조](errors.md#입력-검증-오류). 아래 타입은 목표 계약이며 런타임 코드는 후속 구현
- **프론트:** 수신값은 먼저 `unknown`으로 받고 검증; 타입 단언만으로 신뢰하지 않음

```ts
export interface FieldError {
  location: "body" | "query" | "path" | "header";
  path: (string | number)[]; // number는 0 이상의 정수 인덱스
  code: string; // REQUIRED 등 공개 코드. 미지의 코드는 일반 안내로 처리
  detail: string;
}
export interface ApiError {
  status: number;
  code: string; // 미지의 업무 코드도 처리
  detail: string;
  errors: FieldError[];
}
```

### API별 타입 연결

- 모든 `{...Id}` Path 값: `UUID`
- Body/Query가 `—`인 API: 해당 입력 없음
- 성공 응답 타입: JSON 본문 기준; O03만 조건부 바이너리

| API | Body / Query | 성공 응답 타입 |
|---|---|---|
| E01 | Body `EventApplicationRequest` | `Application` |
| E02 | — | `Application` |
| E03 | Body `SessionRequest` | `Session` |
| E04 | — | `SessionMe` |
| E05 | — | `MapData` |
| I01 | Body `AnalysisRequest` | `AnalysisCreated` |
| I02 | — | `Analysis` |
| I03 | Body `StaffReportRequest` | `StaffReport` |
| I04 | Body `AdminReportRequest` | `ReportDetail` |
| R01 | Query `PageQuery` | `Page<StaffReport>` |
| R02 | — | `StaffReport` |
| R03 | Query `AdminReportQuery` | `Page<ReportCard>` |
| R04 | — | `ReportDetail` |
| R05 | Query `ReportFilterQuery` | `Page<MapPin>` |
| R06 | Query `PageQuery` | `Page<Log>` |
| R07 | Body `ClaimRequest` | `ReportDetail` |
| R08 | Body `ClassificationRequest` | `ReportDetail` |
| R09 | Body `ResolveRequest` | `ReportDetail` |
| R10 | Body `VersionRequest` | `ReportDetail` |
| R11 | Body `CancelReportRequest` | `ReportDetail` |
| R12 | Body `VersionRequest` | `SupportRequestResult` |
| R13 | Body `VersionRequest` | `SupportRequestResult` |
| R14 | Query `PageQuery` | `Page<Participation>` |
| R15 | Body `VersionRequest` | `ParticipationResult` |
| R16 | Body `VersionRequest` | `ParticipationResult` |
| O01 | — | `AdminStats` |
| O02 | Query `ActivityReportQuery` | `ActivityReport` |
| O03 | Query `ActivityPeriodQuery` | `ActivityPdf` (서버 PDF 선택 시) |
| O04 | Query `RouteQuery` | `RouteResponse` |

---

## API 검증·결정 목록

> 상태: 검토안. 문서 검토 결과와 실제 API 테스트를 구분합니다. 이번 작업은 코드·ERD 구현을 포함하지 않습니다.

### 구현 전 검토 대상

| ID | 제안/미정 | 영향 |
|---|---|---|
| A-01 | 신청과 코드 발급 자원 분리, 신청자 증명·발급/반려·지도 매칭 정책 미정(TBD-01·02) | E01·E02·E05 |
| A-02 | Bearer 시작안, 관리자 자격·동일인 복구·만료/갱신·로그아웃 미정(TBD-01·04) | E03·E04·전체 권한 |
| A-03 | 비동기 분석+폴링, 파일/문자 제한·TTL·실패 대안 미정(TBD-06) | I01~04 |
| A-04 | [#50 재전송 계약](#재전송동시성): 생성 우선·수동 재시도·결과 보관·자동 만료 없음 확정. E01/E03 증명 수단은 #51과 결정 | 모든 변경·오프라인 |
| A-05 | report.version 통합 경합 제어·지원 요청/참여별 ID, 지원 자동 정리 제안(TBD-07) | R07~16 |
| A-06 | cursor·20/100·동률 정렬·필터 우선·지도 페이지 수신 제안, 임계 변경·통계 대상 미정(TBD-05·11) | R01~06·O01 |
| A-07 | 리포트 기간·재배정·메모 공개·PDF 방식 미정(TBD-10) | StaffReport·O02·O03 |
| A-08 | 정상 GPS만 표현, GPS 실패/오차/구역 밖 미정(TBD-03·06), 경로 미검증(TBD-09) | I03·O04 |
| A-09 | [#50 표현 계약](#표현-규칙)과 [422 계약](errors.md#입력-검증-오류) 확정·미구현. 기능별 업무 코드는 별도 검토 | 전체 계약·공통 핸들러 후속 확장 |

- API 영문 enum·필드명이 기획 확정을 대신하지 않음
- 고정된 ‘최대 지원 인원’이나 ‘자동 긴급 승격’을 추가하지 않았습니다
- 동시성 제안을 채택하더라도 담당 권한·취소 권한 자체는 PRD 확정 기준을 따릅니다

### 공통 계약 요청·응답 검토 예시

> #50 최소 재전송 정책은 확정·미구현입니다. 공통 표현·422 항목도 확정했으며 기능별 성공 DTO는 검토안입니다. 아래 예시는 실행 결과가 아닙니다. 인증 값은 설명용 자리표시자입니다.

```http
POST /api/v1/report-analyses HTTP/1.1
Authorization: Bearer <valid-session>
Content-Type: application/json
Idempotency-Key: 5891cefa-67c9-4912-8ef4-7dc2074aec7a

{"inputMethod":"TEXT","text":"정문 앞 통로가 혼잡합니다."}
```

```http
HTTP/1.1 202 Accepted
Content-Type: application/json
Location: /api/v1/report-analyses/279fbc88-c21b-4a5b-8d67-90ef80ecaabe

{"id":"279fbc88-c21b-4a5b-8d67-90ef80ecaabe","status":"PENDING"}
```

| 검증 ID | 요청·상황 | 기대 결과 |
|---|---|---|
| C01 | 위 정상 요청 | 202·모델 직접 반환·Location. 분석 1개, 최종 신고 0개 |
| C02 | text가 공백만이고 actorId 추가 | [422 예시](errors.md#입력-검증-오류), 생성 0개. 키 선점 전 오류 |
| C03 | 동일 주체가 같은 키·본문으로 응답 유실 후 재전송 | 최초 202·같은 ID·Location. 분석·외부 작업 중복 등록 없음 |
| C04 | 같은 키에서 text 변경 | 409 IDEMPOTENCY_CONFLICT, errors는 빈 배열, 자동 재시도 금지 |
| C05 | 첫 요청 처리중 같은 키·본문 | 409 REQUEST_IN_PROGRESS, 중복 실행·자동 재시도 없음 |
| C06 | 키 선점 후 5xx 실패 결과 저장·전체 롤백 확인 | 같은 키는 저장한 안전한 실패 응답. 새 작업은 사용자 확인 후 새 키 |
| C07 | 처리 완료 여부 불명·프로세스 종료 | 결과 확인 전 재실행 금지. 같은 키는 처리중 응답, 확정 후 최초 결과 복구 |
| C08 | 최초 요청에서 24시간 경과 | 시간 만료가 없으므로 같은 인증 주체·키·내용은 기존 결과 반환 |
| C09 | 세션 만료 상태에서 성공했던 요청 재전송 | 401, 저장 결과 노출 없음. 동일 actor로 재인증·접근 권한 확인 후 최초 결과 |
| C10 | 다른 actor로 재진입 또는 기존 자원 권한 상실 | 이전 결과 복구 불가. 새 actor의 자동 재전송 중단; 접근 거절 시 본문 비노출 |
| C11 | 성공 후 자원 version 증가·분석 READY 전환 | 같은 키는 최초 응답. 최신 상태는 GET, 오래된 version으로 화면을 되돌리지 않음 |
| C12 | JSON 키 순서/구문 공백만 변경 또는 multipart boundary만 변경 | 동일 요청. 문자열 내용·파일 바이트·MIME 변경은 충돌 |
| C13 | 키 누락/복수/형식 오류·JSON 중복 키·미등록 쿼리 | 422, 업무 실행 없음. location/path는 오류 계약과 일치 |
| C14 | E01·E03 키만 알고 증명 없이 결과 요청 | 결과 비노출. 정상 복구 테스트는 #51의 사전 진입 증명 계약을 먼저 연결 |
| C15 | PATCH 성공 응답 유실 후 같은 expectedVersion 재전송 | 상태·이력 중복 변경 없음. 최초 200 복구를 기대하지 않고 충돌 후 GET으로 확인 |
| C16 | R12·R15 POST에서 성공 후 같은 키·본문 재전송 | 버전 증가 후에도 최초 생성 결과 복구, 지원요청·참여 중복 생성 없음 |
| C17 | PATCH 요청의 키 없음/있음 | 키 유무로 결과 저장·복구 동작이 생기지 않음. 버전 검사 적용 |
| C18 | 날짜·시각·UUID 입력 | 유효한 날짜, 시간대 있는 시각, 하이픈 UUID 허용. 날짜 불능·시간대 누락·잘못된 UUID는 422; 출력은 문자열·UTC 밀리초 |
| C19 | 선택 필드 생략·null·빈 목록 | 생략은 명세 기본 동작, 허용하지 않은 null은 422. PATCH 생략은 유지·삭제 허용 필드의 null만 삭제. 빈 목록은 [] |
| C20 | 중첩 body·query·path·header 입력 오류 | 외부 필드명과 배열 인덱스로 location/path 구성. 최상위 detail은 문자열·errors는 배열, 입력 원문·내부 예외 비노출 |
| C21 | 성공 응답·추가 입력·타입 변환 | 래퍼 없이 선언한 모델 반환. 중첩 미등록 키·JSON 숫자의 문자열 대체는 422. /health 기존 계약 유지 |

C04·C05 응답 본문 예시:

```json
{"status":409,"code":"IDEMPOTENCY_CONFLICT","detail":"같은 요청 키에 다른 입력을 사용할 수 없습니다.","errors":[]}
```

```json
{"status":409,"code":"REQUEST_IN_PROGRESS","detail":"이전 요청을 처리하고 있습니다. 잠시 후 다시 확인해주세요.","errors":[]}
```

### 기존 계약 대조와 남은 채택

| 대상 | 유지하는 확정 사항 | 채택 결과·후속 영향 |
|---|---|---|
| D-021·D-031 네이밍 | JSON·쿼리 camelCase만 지원 | 미등록 입력을 무시하는 현재 기본 동작에서 422 거절로 변경 필요 |
| D-020·D-022 오류 | 최상위 status/code/detail/errors·기존 코드 5개 | 422 항목의 location/path/code/detail 추가. 기본 FastAPI 422 소비부·OpenAPI 변경 필요 |
| D-024 DB ID | 일반 엔티티 UUIDv4 생성 | 외부 UUID 형식 구체화. 코드·토큰·커서는 제외 |
| GET /health·일반 오류 구현 | 기존 성공 본문·400/404/405/500 동작 | 이번 문서 작업에서 구현 변경 없음 |
| 축제 DTO | 기능별 필드·업무 정책은 별도 검토 | 확정한 시각 형식·null·추가 필드 거절·키 보존을 스키마와 호출부에 적용 |

현재 **공통 표현·422 항목·생성 요청 우선 적용과 최소 재전송 정책을 채택했습니다**. 자동 재시도·시간 만료 없이 결과를 보관하고 PATCH는 버전 검사·재조회로 확인합니다. #50의 일반 공통 규칙은 정리했으며 행사·세션 생성 전 식별 경계가 남아 있어 이슈 전체 완료로 닫지 않습니다. E01/E03의 구체 증명 수단은 #51과 공동 결정할 남은 항목입니다. #54는 공통 기반, 각 기능 이슈는 실제 요청/권한/저장 테스트, #64는 클라이언트의 키 보존·수동 재시도·재인증 안내를 검증합니다. C01~C21은 구현 시 사용할 조건이며 현재 API 통과 결과가 아닙니다.

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

- 지원 정리·기간 산식·GPS 실패 등 조건부 행위는 먼저 정책을 채택한 뒤 테스트 기대값을 확정함
- 문서 속 예시 응답을 mock으로 반환한 결과는 실제 동시성·접수·AI·지도 기능 검증이 아닙니다

### 검토 후 순서

- 공통 요청/응답과 인증 경계를 먼저 합의한 후, 분석·접수와 담당·취소·지원의 핵심 계약을 고정함
- 화면에 필요한 모델을 확정한 뒤 FastAPI 스키마·OpenAPI·계약 테스트·프론트 호출을 연결함
- ERD는 저장 무결성·이력·멱등성 보관에 필요한 내용을 별도 설계하며 이번 공개 모델을 그대로 테이블로 복사하지 않음
