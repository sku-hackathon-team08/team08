# 공개 데모 행사 지도 API

> 상태: PR #66에서 구현. 백엔드 소유의 가상 행사 seed를 읽는 데모 전용 API입니다.
> 인증된 제품 E05 (`GET /api/v1/events/current/map`)의 구현·권한 계약을 대체하지 않습니다.

## 지도 조회

`GET /api/v1/demo/events/{eventId}/map`

- 현재 행사 ID: `69cbb93b-d6cb-5785-a7c8-e606c7279d3d`.
- 인증 없음. 공개 가상 데모 데이터만 제공합니다.
- 200: `DemoMapResponse` ([스키마](../../backend/app/schemas/demo_map.py)).
- 응답: `eventId`, `name`, `status`, `dataVersion`, `center`, `zones`, `gates`, `model`, `demoPoint`.
- `model`: 행사에 연결된 `uri`, `position`, `headingDegrees`, `metersPerUnit`, `heightPolicy`와 모델 통계.
- `demoPoint`: `lng`, `lat`, `zoneId`, `surfaceOffsetMeters`. 지형 기준 높이는 프론트에서 계산합니다.
- 구역·게이트 표현과 확정한 데모 값은 [작업 기준](../integrations/vworld-demo.md)을 따릅니다.
- 모르는 행사: 공통 404 `NOT_FOUND`. 잘못된 UUID: 공통 필드 오류 422.
- 저장된 seed 누락·손상: 서버 오류이며 빈 구역이나 다른 행사로 대체하지 않습니다.

## 행사 파일 조회

`GET /api/v1/demo/events/{eventId}/assets/{assetName}`

- 허용 파일: `concert.glb`, `concert-zones.geojson`, `concert-coordinates.csv`.
- 200: 각각 `model/gltf-binary`, `application/geo+json`, `text/csv` 파일.
- 행사 일치 확인 후 파일을 제공합니다. 모르는 행사는 지도 조회와 동일한 404.
- 허용 목록 외 파일명: 공통 필드 오류 422. 임의 디렉터리를 정적으로 공개하지 않습니다.
- GLB URL은 지도 응답의 `model.uri`를 사용합니다. 후속 정적 저장소 도입 시 반환 URL을 바꿀 수 있습니다.

## 구현 경계

배치 원본·생성기·산출물은 `backend/demo`, `backend/scripts`에 있습니다.
저장소 계층이 seed를 읽고 검증하며 HTTP 라우트가 스키마와 파일을 반환합니다.
프론트 담당자는 이 API를 호출해 렌더링합니다. 프론트 코드·SDK·프록시 설정은 이 PR의 구현 범위에서 제외합니다.
인증된 행사 컨텍스트·업무 DB·공통 코드 진입은 [해커톤 API](hackathon.md)에 구현했습니다. 이 공개 API는 기존 가상 seed 조회로 유지합니다.
