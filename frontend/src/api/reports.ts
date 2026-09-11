import type { ReportType, Urgency } from '../types/report'
import { apiRequest, apiRequestWithLocation } from './client'
import type {
  ApiMapPin,
  ApiReportCard,
  ApiReportDetail,
  ApiStaffReport,
  DashboardStats,
  LogEntry,
  Page,
} from './types'

/**
 * 데모 행사 고정 좌표(서울 월드컵경기장) — docs/api/hackathon.md 예시와 동일.
 * 스태프 신고는 서버가 어차피 DEMO_FIXED로 덮어써서 값 자체는 안 쓰이지만, position이
 * 스키마상 필수라 형식은 맞춰 보내야 한다. 관리자 직접 신고(지도 클릭 선택)는 실제 지도
 * 연동 전이라 같은 값을 임시로 쓴다 — 지도 붙이면 실제 클릭 좌표로 교체.
 */
const DEMO_POSITION = { lat: 37.5683536, lng: 126.8970733 }

function nowPosition() {
  return { ...DEMO_POSITION, capturedAt: new Date().toISOString(), accuracyMeters: null }
}

export async function createStaffReport(input: {
  analysisId: string
  contentFinal: string
  type: ReportType
  urgency: Urgency
}): Promise<ApiStaffReport> {
  const { data } = await apiRequestWithLocation<ApiStaffReport>('/staff/reports', {
    method: 'POST',
    role: 'staff',
    idempotent: true,
    json: { analysisId: input.analysisId, contentFinal: input.contentFinal, type: input.type, urgency: input.urgency, position: nowPosition() },
  })
  return data
}

export async function createAdminReport(input: { analysisId: string; contentFinal: string; type: ReportType }): Promise<ApiReportDetail> {
  const { data } = await apiRequestWithLocation<ApiReportDetail>('/admin/reports', {
    method: 'POST',
    role: 'admin',
    idempotent: true,
    json: { analysisId: input.analysisId, contentFinal: input.contentFinal, type: input.type, position: nowPosition() },
  })
  return data
}

export function listStaffReports(cursor?: string): Promise<Page<ApiStaffReport>> {
  return apiRequest('/staff/reports', { role: 'staff', query: { cursor } })
}

export function getStaffReport(id: string): Promise<ApiStaffReport> {
  return apiRequest(`/staff/reports/${id}`, { role: 'staff' })
}

export function listAdminReports(params: {
  sort?: 'recent' | 'urgency'
  types?: string
  statuses?: string
  cursor?: string
  pageSize?: number
}): Promise<Page<ApiReportCard>> {
  return apiRequest('/admin/reports', { role: 'admin', query: params })
}

export function getAdminReport(id: string): Promise<ApiReportDetail> {
  return apiRequest(`/admin/reports/${id}`, { role: 'admin' })
}

export function listMapPins(cursor?: string): Promise<Page<ApiMapPin>> {
  return apiRequest('/admin/map-reports', { role: 'admin', query: { cursor } })
}

export function listReportLogs(id: string, cursor?: string): Promise<Page<LogEntry>> {
  return apiRequest(`/admin/reports/${id}/logs`, { role: 'admin', query: { cursor } })
}

export function claimReport(id: string, input: { expectedVersion: number; type: ReportType; urgency: Urgency }): Promise<ApiReportDetail> {
  return apiRequest(`/admin/reports/${id}/claim`, { method: 'PATCH', role: 'admin', json: input })
}

export function updateClassification(
  id: string,
  input: { expectedVersion: number; type?: ReportType; urgency?: Urgency },
): Promise<ApiReportDetail> {
  return apiRequest(`/admin/reports/${id}/classification`, { method: 'PATCH', role: 'admin', json: input })
}

export function resolveReport(id: string, input: { expectedVersion: number; resolveNote?: string }): Promise<ApiReportDetail> {
  return apiRequest(`/admin/reports/${id}/resolve`, { method: 'PATCH', role: 'admin', json: input })
}

export function releaseReport(id: string, input: { expectedVersion: number }): Promise<ApiReportDetail> {
  return apiRequest(`/admin/reports/${id}/release`, { method: 'PATCH', role: 'admin', json: input })
}

export function cancelReport(id: string, input: { expectedVersion: number; cancelReason: string }): Promise<ApiReportDetail> {
  return apiRequest(`/admin/reports/${id}/cancel`, { method: 'PATCH', role: 'admin', json: input })
}

export function getDashboardStats(): Promise<DashboardStats> {
  return apiRequest('/admin/stats', { role: 'admin' })
}
