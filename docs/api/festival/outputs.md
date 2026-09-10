# 활동 리포트·PDF·경로 API

> **조건부 검토안·미구현**. 기준: [활동 리포트](../../features/activity-report.md), [관제](../../features/command-dashboard.md). 집계·PDF·경로 제공자를 이번 문서에서 확정하지 않습니다.

## O01 — GET /admin/stats

같은 행사 ADMIN. 200 `{total:integer,unacknowledged:integer,inProgress:integer,resolved:integer,asOf:string}` 제안입니다. total의 취소 포함 여부는 TBD-05/10을 먼저 결정해야 합니다. 쿼리는 없습니다. 목록 필터의 통계인지 행사 전체 통계인지도 A-06에서 결정합니다. 401/403.

## O02 — GET /staff/activity-report

인증한 STAFF 본인의 리포트입니다. 관리자 개인 리포트는 기획 미정이므로 `/admin/my-reports`를 확정 목록에 추가하지 않습니다.

쿼리 제안: `period=TODAY|WEEK|ALL`, cursor?,pageSize?. 기본은 TODAY. 200 응답 제안:

`{actor:{id,name,team},range:{from:string|null,to:string|null,timeZone:string},summary:{total:integer,resolved:integer,cancelled:integer,averageProcessingSeconds:number|null},typeDistribution:[{type:ReportType,count:integer}],items:StaffReport[],nextCursor:string|null,asOf:string}`.

기간 경계, 접수/완료 중 포함 시각, 비교 수치·재배정 산식은 TBD-10에 의존합니다. 명세를 채택할 때 range가 실제 사용한 구간을 반환하도록 합니다. 요약은 전체 선택 범위 기준이며 현재 페이지만 집계하지 않습니다. 미정 산식을 0으로 대체해 확정 결과처럼 반환하지 않습니다.

평균의 시작·종료는 담당 배정→완료입니다. 단일 배정의 경우 접수 10:00·배정 10:05·완료 10:15이면 600초입니다. 완료 0건의 null 및 소수 반올림은 검토안입니다. 재배정된 건을 제외하거나 최신 claimedAt만 쓰는 정책은 확정하지 않습니다. 401/403/422.

## O03 — GET /staff/activity-report/export

STAFF 본인, `period=TODAY|WEEK|ALL` 제안입니다. 이 경로와 매체는 PDF 생성 방식을 고른 뒤 채택할 조건부 계약입니다.

- 서버 PDF를 선택하면 200 `application/pdf`, `Content-Disposition: attachment; filename="activity-report.pdf"`. 빈 본문 JSON이나 JSON export를 PDF라고 부르지 않습니다.
- 앱에서 PDF를 만들기로 하면 이 경로 대신 전체 범위 export 데이터 계약을 작성합니다. 페이지 제한 없는 조회의 규모·시간 제한도 함께 정합니다.
- 어느 방식이든 선택 기간 전체 요약과 내역을 사용하며 마지막 페이지 누락이 없어야 합니다. 다른 스태프 데이터는 포함하지 않습니다.
- 생성 시점 스냅샷, 파일 보관·유효기간·다운로드 재시도·장시간 생성의 비동기 전환은 A-07 미정입니다. 401/403/422, 생성 오류의 실제 계약은 방식 선정 후 정의합니다.

## O04 — GET /admin/reports/{reportId}/route

같은 행사 ADMIN. `gateId:string` 필수, `mode=WALKING` 제안입니다. 경로 제공자 지원이 확인된 경우에만 채택하며 자동차·임의 안전 경로를 확정하지 않습니다.

200 제안:
`{reportId:string,gateId:string,status:AVAILABLE|NO_ROUTE,geometry:{type:"LineString",coordinates:number[][]}|null,distanceMeters:number|null,durationSeconds:number|null,provider:string|null,generatedAt:string}`.

AVAILABLE은 실제 제공자 경로·거리·시간·provider가 non-null, NO_ROUTE는 geometry/거리/시간 null입니다. geometry 좌표는 경도·위도 순서입니다. 응답 없음과 제공자 장애(503)를 구분합니다. 다른 행사 게이트는 404이며 실제 동선 적합성·출발 게이트·도보 지원·캐시·종결 신고 경로 허용은 TBD-09입니다. 제공자 미선정 상태에서 NO_ROUTE 가짜 성공이나 직선을 실제 경로로 반환하지 않습니다.
