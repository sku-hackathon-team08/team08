import { apiRequest } from './client'
import type { Page, ParticipationResult, ParticipationView, SupportResult } from './types'

/**
 * 지원요청(support-requests) — openSupportRequest/joinSupportRequest는 AdminHomePage의
 * handleRequestSupport(08-A/08-B 공용)에서 쓴다. closeSupportRequest·cancelParticipation·
 * listParticipants는 아직 화면에 안 붙였다 — 종료는 report-lifecycle.md 확정대로 완료·취소·
 * 담당해제 시 백엔드가 자동으로 같이 끝내서 버튼이 필요 없고, 본인 참여취소·참여자 목록 조회는
 * 이 dc.html 화면 세트에 없어 다음 작업으로 남긴다.
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
