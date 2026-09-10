# 행사·세션·제공자 지도 API

> 검토안·미구현. 기준: [행사 진입](../../features/event-entry.md). 공통 접두사·모델·오류는 [공통 규칙](common.md).
> **조건부:** TBD-01·02·04(코드 발급, 자격, 지도 매칭, 앱 방식). 사용자 구역 편집 API는 없습니다.

## E01 — POST /event-applications

행사 신청을 생성합니다. 신청자 자격 방식은 미정이며 공개 무인증 운영을 채택한 것이 아닙니다.

요청 제안: `eventName:string`, `applicantName:string`, `venueName:string`, `startDate:YYYY-MM-DD`, `endDate:YYYY-MM-DD`. 모두 필수, 시작일≤종료일. 날짜를 자동으로 운영 시작/종료 시각으로 해석하지 않습니다. 장소 자유문자와 제공자 데이터의 매칭 방식은 TBD-02입니다. zones·gates·폴리곤 입력은 받지 않습니다.

201 응답: `Application {id:string,status:PENDING|ISSUED,eventId:string|null,eventCode:string|null}`. ISSUED일 때 eventId/eventCode를 함께 제공하고 PENDING에는 둘 다 null입니다. 신청 시 즉시 발급인지 준비 후 발급인지 미정이므로 둘 다 표현할 수 있는 제안입니다. 신청자 자동 관리자 로그인은 하지 않습니다.

오류: 422 입력 오류, 401/403 신청자 자격 오류(정책 결정 후), 공통 멱등성 오류. 미지원 장소의 반려·재신청은 상태/오류를 임의 확정하지 않고 A-01에서 결정합니다.

## E02 — GET /event-applications/{applicationId}

신청자 본인만 조회합니다. 200 Application. 본인 증명 수단은 A-01 미정이며 ID를 안다는 것만으로 행사 코드를 노출하지 않습니다. 401/403/404.

## E03 — POST /sessions

역할별 진입을 하나의 계약으로 제안합니다.

- 요청: `eventCode:string`, `role:STAFF|ADMIN`, `name:string`, STAFF의 `team:string` 필수. ADMIN은 team을 보내지 않습니다.
- 관리자 자격 증명 입력은 아직 정의하지 않았습니다. 현재 필드만으로 운영 인증을 구현하지 않습니다.
- 201: `Session {token:string,expiresAt:string,role:STAFF|ADMIN,event:{id:string,name:string},actor:{id:string,name:string,team:string|null}}`.
- 같은 이름의 동명이인을 자동으로 기존 계정으로 복구하지 않습니다. 역할·세션 재진입 동일인 처리와 코드 오류 표시는 A-02에서 결정합니다.
- 오류: 422, 자격 불충족 401/403, 공통 멱등성 오류. 토큰 생성·만료 길이·발급 재시도 정책은 조건부입니다.

## E04 — GET /sessions/me

인증한 본인의 `role,event,actor,expiresAt`을 200으로 반환합니다. token을 재노출하지 않습니다. 팀은 소속 표시이며 zoneId 필드는 없습니다. 401.

## E05 — GET /events/current/map

같은 행사 STAFF/ADMIN 읽기 권한으로 200 MapData를 반환하는 제안입니다.

`MapData {eventId:string,dataVersion:string,center:{lat:number,lng:number},zones:Zone[],gates:Gate[],asOf:string}`.

- Zone: `id:string,name:string,geometry:{type:"Polygon",coordinates:number[][][]}`. 좌표 배열 순서는 `[경도,위도]` 제안입니다. WGS84 경위도이며 첫/마지막 점은 같아야 합니다. 다중 구역 형상 지원은 제공 데이터 검증 후 확장합니다.
- Gate: `id:string,name:string,position:{lat:number,lng:number},zoneId:string|null`.
- 브이월드 타일 자체나 서버 비밀 키를 반환하지 않습니다. 클라이언트 지도 SDK·키 정책은 외부 연동 문서의 후속 계약입니다.
- 잘못된 행사·준비되지 않은 데이터를 빈 구역 배열로 성공 처리해 준비 완료처럼 보이지 않습니다. 준비중 상태의 HTTP/코드는 A-01에서 결정합니다.
- 오류: 401/404, 실제 동기 제공자 호출 실패는 503. 저장된 구역 조회와 외부 지도 렌더 실패를 같은 오류로 취급하지 않습니다.

## 예시

```json
{"eventCode":"DEMO26","role":"STAFF","name":"김스태프","team":"운영팀"}
```

위 코드는 설명용입니다. 실제 코드 길이·문자 조합의 검증 기준이 아닙니다.
