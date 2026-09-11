import { apiRequest } from './client'
import type { SessionCreated, SessionInfo } from './types'

/**
 * POST /sessions — 세션 자체가 없는 시점의 호출이라 role(Authorization)도 Idempotency-Key도
 * 안 붙인다(백엔드 감사에서 확인한 유일한 예외 엔드포인트). team은 STAFF면 필수, ADMIN이면
 * 아예 키 자체를 보내면 안 된다(백엔드가 `team` 존재 여부 자체를 검사함) — 그래서 ADMIN
 * 호출은 team을 인자로도 안 받는다.
 */
export function createAdminSession(input: { eventCode: string; name: string }): Promise<SessionCreated> {
  return apiRequest('/sessions', { method: 'POST', json: { eventCode: input.eventCode, role: 'ADMIN', name: input.name } })
}

export function createStaffSession(input: { eventCode: string; name: string; team: string }): Promise<SessionCreated> {
  return apiRequest('/sessions', {
    method: 'POST',
    json: { eventCode: input.eventCode, role: 'STAFF', name: input.name, team: input.team },
  })
}

export function getMySession(role: 'admin' | 'staff'): Promise<SessionInfo> {
  return apiRequest('/sessions/me', { role })
}

export function deleteMySession(role: 'admin' | 'staff'): Promise<void> {
  return apiRequest('/sessions/me', { method: 'DELETE', role })
}
