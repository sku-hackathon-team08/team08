import type { ReportStatus, ReportType, Urgency } from './report'

/**
 * 스태프 화면(S1/S4) 표시용 타입. 원래 mocks/staffReports.ts에 있던 정의를 API 연동 후
 * 이쪽으로 옮겼다(목데이터 파일은 지웠지만 타입은 ReportHistoryScreen 등에서 계속 쓴다).
 */

export type StaffTimelineEntry = {
  status: ReportStatus
  at: string
  /** 관리자 확인·완료 메모 — 실제 GET /staff/reports 응답엔 이 텍스트가 없어서(ReportDetail
   * 전용 필드) 실연동 후에는 항상 undefined다. 화면은 없으면 그냥 안 보여준다. */
  note?: string
}

export type StaffReportSummary = {
  id: string
  /** S1/S4 카드 제목 — 원문(message) 요약이 아니라 접수 화면에 쓰는 짧은 라벨 */
  title: string
  /** 스태프가 실제로 말한/입력한 내용 그대로 */
  message: string
  type: ReportType
  urgency: Urgency
  status: ReportStatus
  createdAt: string
  timeline: StaffTimelineEntry[]
}
