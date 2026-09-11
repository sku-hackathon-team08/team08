import { API_BASE_URL, apiRequest } from './client'
import { getSession } from '../lib/session'
import type { AdminActivityReport } from './types'

/**
 * 나의 리포트(12) — MyReportView의 화면 통계·상세 이력·PDF 내보내기가 모두 이 API를 쓴다
 * (2026-09-12: 로컬 reports 배열 근사 집계에서 전환). listAdminReports와 같은 관례로
 * pageSize는 최댓값(100)만 받는다 — 그 이상 쌓이면 다음 페이지는 아직 안 가져온다(커서 UI는
 * 다음 작업, AdminHomePage.tsx 참고). summary·typeDistribution은 페이지 크기와 무관하게 항상
 * 선택 기간 전체 기준이다.
 */
export function getAdminActivityReport(
  period: 'TODAY' | 'WEEK' | 'ALL',
  cursor?: string,
  pageSize?: number,
): Promise<AdminActivityReport> {
  return apiRequest('/admin/activity-report', { role: 'admin', query: { period, cursor, pageSize } })
}

/** PDF 내보내기 — 응답이 raw PDF라 Blob으로 받아서 다운로드 링크를 만든다. */
export async function downloadAdminActivityReportPdf(period: 'TODAY' | 'WEEK' | 'ALL'): Promise<Blob> {
  const token = getSession('admin')?.token
  const res = await fetch(`${API_BASE_URL}/admin/activity-report/export?period=${period}`, {
    headers: typeof token === 'string' ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error('PDF 생성에 실패했습니다.')
  return res.blob()
}
