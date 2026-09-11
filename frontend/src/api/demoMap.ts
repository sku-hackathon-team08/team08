import { apiRequest } from './client'

/**
 * 공개 데모 지도 API — docs/api/demo-map.md·docs/integrations/vworld-demo.md.
 * 인증된 제품 E05(GET /events/current/map)를 대체하지 않는 별도 공개 엔드포인트라
 * role(Authorization)을 안 붙인다. 행사 ID는 이번 해커톤 데모 전용 고정값
 * (backend/app/db/seed_demo.py와 동일) — 로그인 세션 응답엔 이 id가 없어서 상수로 둔다.
 */
export const DEMO_MAP_EVENT_ID = '69cbb93b-d6cb-5785-a7c8-e606c7279d3d'

export type DemoZone = {
  id: string
  key: string
  name: string
  color: string
  areaSquareMeters: number
  geometry: { type: 'Polygon'; coordinates: number[][][] }
}

export type DemoGate = {
  id: string
  name: string
  position: { lng: number; lat: number }
  zoneId: string | null
}

export type DemoModel = {
  uri: string
  position: { lng: number; lat: number }
  headingDegrees: number
  metersPerUnit: number
  heightPolicy: string
  nodeCount: number
  componentCount: number
  seatMarkers: number
}

export type DemoPoint = {
  lng: number
  lat: number
  zoneId: string | null
  surfaceOffsetMeters: number
}

export type DemoMapResponse = {
  eventId: string
  name: string
  status: string
  dataVersion: string
  center: { lng: number; lat: number }
  zones: DemoZone[]
  gates: DemoGate[]
  model: DemoModel
  demoPoint: DemoPoint
}

export function getDemoMap(eventId: string = DEMO_MAP_EVENT_ID): Promise<DemoMapResponse> {
  return apiRequest(`/demo/events/${eventId}/map`)
}

/** model.uri는 백엔드 origin 기준 상대 경로라 API_BASE_URL의 origin과 합쳐야 한다. */
export function resolveDemoAssetUrl(uri: string): string {
  const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://127.0.0.1:8000/api/v1'
  const origin = new URL(apiBase).origin
  return `${origin}${uri}`
}
