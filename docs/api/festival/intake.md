# 분석·신고 접수 API

> 검토안·미구현. 기준: [입력 흐름](../../features/report-intake.md). 공통은 [공통 규칙](common.md).
> GPS 실패·위치 허용 오차·입력/파일 제한·분석 실패 대안은 TBD-03·06입니다. 아래 접수는 정상 GPS 확보 흐름만 정의하며 GPS 실패 때 전송 차단/수동 대체를 확정하지 않습니다.

## I01 — POST /report-analyses

인증한 STAFF/ADMIN이 본인 분석을 생성합니다. 최종 신고는 아직 없습니다. ADMIN은 TEXT만 사용합니다.

- 텍스트 `application/json`: `{inputMethod:"TEXT",text:string}`.
- 음성 `multipart/form-data`: `inputMethod=VOICE`, `audio` 바이너리 파일 한 개. 녹음 종료 후 업로드하는 제안입니다.
- 202: `{id:string,status:"PENDING"}`. Location은 `/api/v1/report-analyses/{id}`입니다.
- 필수 헤더 Idempotency-Key. 같은 키로 재업로드해도 분석 작업을 중복 실행하지 않습니다.
- 오류: 401/403, 422 빈 텍스트/필드 오류, 413/415 파일 제한, 공통 멱등성 오류.
- 허용 코덱·MIME·파일 크기·녹음 길이·텍스트 길이·분석 보관 기간은 A-03 미정입니다.

## I02 — GET /report-analyses/{analysisId}

행사·분석 소유자 일치 시 200 Analysis를 반환합니다. 다른 행위자 분석은 404. 폴링을 시작안으로 제안하며 주기는 미정입니다.

`Analysis {id:string,status:PENDING|PROCESSING|READY|FAILED,transcriptRaw:string|null,contentSuggested:string|null,typeSuggested:ReportType|null,urgencySuggested:Urgency|null,expiresAt:string|null,failureCode:string|null}`.

- READY: 원문·내용·유형·위험도는 모두 non-null, failureCode는 null.
- PENDING/PROCESSING: 결과 필드는 모두 null.
- FAILED: 결과 필드는 null, failureCode는 TRANSCRIPTION_FAILED 또는 ANALYSIS_FAILED 제안. 내부 제공자 오류 문자열은 노출하지 않습니다.
- 텍스트의 transcriptRaw는 최초 입력 원문입니다. 음성은 최초 STT 변환문이며 사용자의 수정 내용과 구분합니다.
- expiresAt은 실제 유효기간을 정한 후 채웁니다. null은 유효기간 정책 미설정이며 무기한 보존 확정이 아닙니다.
- 실패 분석에서 자동으로 ‘기타/주의’ 신고를 만들지 않습니다. 수동 전송 허용과 fallback 분류는 미정입니다.

## I03 — POST /staff/reports

STAFF의 확인 화면 ‘전송하기’입니다. 입력은 `analysisId:string`, `contentFinal:string`, `type:ReportType`, `urgency:Urgency`, `position:Position`. 모두 필수입니다. inputMethod·원문·최초 AI 제안은 분석에서 가져옵니다.

- analysisId는 같은 행사·본인 소유·READY·유효한 분석이어야 합니다.
- 201 StaffReport. 상태 RECEIVED, claimedBy/claimedAt/resolvedAt/cancelledAt=null. createdAt은 서버 최종 접수 시각입니다. Location은 `/api/v1/staff/reports/{id}`입니다.
- 서버가 GPS 위치 출처와 현재 구역을 판정합니다. zoneId·positionSource·reporter·status·createdAt 입력은 거절합니다.
- 최종 type/urgency가 AI 제안과 다르면 STAFF_EDITED, 같으면 AI_SUGGESTED로 기록하는 제안입니다. 수정했다 원래 값으로 되돌린 UI 과정까지 ‘최종 값 변경’으로 기록하지 않습니다.
- 분석 하나는 최종 신고 하나에만 사용할 수 있는 제안입니다. 같은 Idempotency-Key 재시도는 최초 201을 복구하고, 다른 키로 재사용하면 409 ANALYSIS_ALREADY_USED입니다.
- 오류: 401/403/404, 409 ANALYSIS_NOT_READY/EXPIRED/ALREADY_USED, 422, 공통 멱등성 오류.

```json
{
  "analysisId":"89b72348-600e-4a27-b2b9-e9e6286f2558",
  "contentFinal":"메인무대 뒤 통로에 사람이 몰려 있어요",
  "type":"CROWD",
  "urgency":"CAUTION",
  "position":{"lat":37.615,"lng":127.013,"capturedAt":"2026-09-10T03:00:00Z","accuracyMeters":12}
}
```

예시 좌표와 시각은 실제 신고가 아닙니다. 위치 정확도·유효 시간 기준을 나타내지 않습니다.

## I04 — POST /admin/reports

ADMIN의 지도 선택 직접 신고입니다. 요청은 `analysisId:string`, `contentFinal:string`, `type:ReportType`, `position:Position`. 분석은 본인 TEXT/READY여야 합니다. urgency 입력은 받지 않고 분석의 위험도 제안을 사용합니다.

201 ReportDetail. 상태 RECEIVED, 담당 없음. type.source=ADMIN_SELECTED, urgency.source=AI_SUGGESTED입니다. `confirmedBy/confirmedAt`은 null이며 생성이 담당 배정·분류 확정을 대체하지 않습니다. positionSource=MAP_SELECTED입니다. 이후 claim으로 맡아야 합니다.

분석 소유권·단일 사용·멱등성·오류는 I03과 같습니다. 관리자가 편집할 위치의 capturedAt은 지도 선택 시각, accuracyMeters는 null입니다. 상세 확인 UI의 분석 호출 위치는 화면 연결 시 검토합니다.

## 오프라인 경계

음성·텍스트 초안과 전송 대기는 아직 서버 신고가 아닙니다. READY 분석을 참조한 최종 전송의 응답만 유실되었다면 동일 키로 복구합니다. 앱이 오프라인에서 새 분석을 완료했다고 표시하지 않습니다. 임시 분석 만료 후 대기 신고 처리, 앱 재설치·세션 만료 후 동일인 복구, 키 보관 기간은 A-02~04에서 결정합니다.

## 최종 접수 성공 응답 예시

다음은 I03의 201 StaffReport 예시입니다. ID·좌표·시각은 설명용입니다.

```json
{
  "id": "57d78bd1-e361-4ba0-9cf7-c2bebacbc9b1",
  "contentFinal": "메인무대 뒤 통로에 사람이 몰려 있어요",
  "type": {"value": "CROWD", "source": "AI_SUGGESTED", "confirmedBy": null, "confirmedAt": null},
  "urgency": {"value": "CAUTION", "source": "AI_SUGGESTED", "confirmedBy": null, "confirmedAt": null},
  "status": "RECEIVED",
  "position": {"lat": 37.615, "lng": 127.013, "capturedAt": "2026-09-10T03:00:00Z", "accuracyMeters": 12},
  "zone": {"id": "a67ed48a-3735-4e5e-a86c-3deac653b52f", "name": "메인무대"},
  "createdAt": "2026-09-10T03:00:05Z",
  "claimedBy": null,
  "claimedAt": null,
  "resolvedAt": null,
  "cancelledAt": null
}
```
