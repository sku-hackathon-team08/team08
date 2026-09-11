import { apiRequest } from './client'
import type { Page, ParticipationResult, ParticipationView, SupportResult } from './types'

/**
 * 지원요청(support-requests) — 클라이언트 함수는 다 만들어뒀지만 08-A/08-B 화면(다른
 * 관리자 지원 참여·본인 참여 취소)엔 아직 안 붙였다. 지금은 ReportDetailPanel의
 * "지원요청" 버튼이 로컬 state(supportRequested)만 바꾸는 상태 — 다음 단계에서 이 함수로
 * 교체한다.
 */

export function openSupportRequest(reportId: string, input: { expectedVersion: number }): Promise<SupportResult> {
  return apiRequest(`/admin/reports/${reportId}/support-requests`, { method: 'POST', role: 'admin', idempotent: true, json: input })
}

export function joinSupportRequest(
  reportId: string,
  requestId: string,
  input: { expectedVersion: number },
): Promise<ParticipationResult> {
  return apiRequest(`/admin/reports/${reportId}/support-requests/${requestId}/participants`, {
    method: 'POST',
    role: 'admin',
    idempotent: true,
    json: input,
  })
}

export function closeSupportRequest(reportId: string, requestId: string, input: { expectedVersion: number }): Promise<SupportResult> {
  return apiRequest(`/admin/reports/${reportId}/support-requests/${requestId}/close`, { method: 'PATCH', role: 'admin', json: input })
}

export function cancelParticipation(
  reportId: string,
  requestId: string,
  participationId: string,
  input: { expectedVersion: number },
): Promise<ParticipationResult> {
  return apiRequest(`/admin/reports/${reportId}/support-requests/${requestId}/participants/${participationId}/cancel`, {
    method: 'PATCH',
    role: 'admin',
    json: input,
  })
}

export function listParticipants(reportId: string, requestId: string, cursor?: string): Promise<Page<ParticipationView>> {
  return apiRequest(`/admin/reports/${reportId}/support-requests/${requestId}/participants`, { role: 'admin', query: { cursor } })
}
