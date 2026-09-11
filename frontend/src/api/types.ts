import type { ReportStatus, ReportType, Urgency } from '../types/report'

/**
 * 백엔드 실제 응답 DTO 타입 — backend/app/schemas/*.py를 그대로 옮긴 것(2026-09-12 코드
 * 감사 기준). camelCase는 backend/app/schemas/base.py의 ApiModel(alias_generator=to_camel)이
 * 전역으로 만들어주므로 여기 필드명도 전부 camelCase다.
 *
 * 화면 컴포넌트는 이 타입을 직접 쓰지 않는다 — types/report.ts의 기존 평평한 Report로
 * adapters.ts가 변환해서 넘긴다(컴포넌트를 새로 안 건드리기 위함).
 */

export type ActorSummary = { id: string; name: string; team: string | null }
export type EventSummary = { id: string; name: string }

export type SessionInfo = {
  role: 'STAFF' | 'ADMIN'
  event: EventSummary
  actor: ActorSummary
  expiresAt: null
}
export type SessionCreated = SessionInfo & { token: string }

export type AnalysisStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED'
export type AnalysisCreated = { id: string; status: 'PENDING' }
export type AnalysisView = {
  id: string
  status: AnalysisStatus
  transcriptRaw: string | null
  contentSuggested: string | null
  typeSuggested: ReportType | null
  urgencySuggested: Urgency | null
  expiresAt: null
  failureCode: string | null
}

export type ActorView = { id: string; name: string }
export type ZoneSummary = { id: string; name: string }
export type Position = {
  lat: number
  lng: number
  capturedAt: string
  accuracyMeters: number | null
}
export type ClassificationSource = 'AI_SUGGESTED' | 'STAFF_EDITED' | 'ADMIN_SELECTED' | 'ADMIN_CONFIRMED'
export type Classification<T> = {
  value: T
  source: ClassificationSource
  confirmedBy: ActorView | null
  confirmedAt: string | null
}

export type ApiStaffReport = {
  id: string
  contentFinal: string
  type: Classification<ReportType>
  urgency: Classification<Urgency>
  status: ReportStatus
  position: Position
  zone: ZoneSummary | null
  createdAt: string
  claimedBy: ActorView | null
  claimedAt: string | null
  resolvedAt: string | null
  cancelledAt: string | null
}

export type ApiReportCard = {
  id: string
  version: number
  contentFinal: string
  type: Classification<ReportType>
  urgency: Classification<Urgency>
  status: ReportStatus
  position: Position
  positionSource: 'DEMO_FIXED' | 'MAP_SELECTED'
  zone: ZoneSummary | null
  createdAt: string
  claimedBy: ActorView | null
  claimedAt: string | null
  isUnacknowledged: boolean
  supportRequestId: string | null
  activeSupporterCount: number
}

export type ApiReportDetail = ApiReportCard & {
  reporter: ActorView
  inputMethod: 'VOICE' | 'TEXT'
  transcriptRaw: string
  contentSuggested: string
  typeSuggested: ReportType
  urgencySuggested: Urgency
  resolvedAt: string | null
  resolveNote: string | null
  cancelledAt: string | null
  cancelledBy: ActorView | null
  cancelReason: string | null
}

export type ApiMapPin = {
  id: string
  version: number
  position: Position
  status: ReportStatus
  type: Classification<ReportType>
  urgency: Classification<Urgency>
  isUnacknowledged: boolean
}

export type Page<T> = { items: T[]; nextCursor: string | null; asOf: string }

export type Change = { field: string; before: unknown; after: unknown }
export type LogEntry = { id: string; action: string; actor: ActorView; occurredAt: string; changes: Change[]; note: string | null }

export type SupportCloseReason = 'MANUAL' | 'REPORT_RELEASED' | 'REPORT_RESOLVED' | 'REPORT_CANCELLED'
export type SupportRequestView = {
  id: string
  reportId: string
  openedBy: ActorView
  openedAt: string
  closedAt: string | null
  closeReason: SupportCloseReason | null
}
export type ParticipationEndReason = 'SELF_CANCELLED' | 'REQUEST_CLOSED'
export type ParticipationView = {
  id: string
  supportRequestId: string
  actor: ActorView
  joinedAt: string
  endedAt: string | null
  endReason: ParticipationEndReason | null
}
export type SupportResult = { supportRequest: SupportRequestView; reportVersion: number }
export type ParticipationResult = { participation: ParticipationView; reportVersion: number }

export type DashboardStats = { total: number; unacknowledged: number; inProgress: number; resolved: number; asOf: string }

export type TypeCount = { type: ReportType; count: number }
export type AdminActivitySummary = {
  totalReports: number
  totalActions: number
  claimed: number
  released: number
  classificationChanged: number
  resolved: number
  cancelled: number
  averageProcessingSeconds: number | null
}
export type AdminActivityItem = {
  id: string
  reportId: string
  action: 'REPORT_CLAIMED' | 'ASSIGNMENT_RELEASED' | 'CLASSIFICATION_CHANGED' | 'REPORT_RESOLVED' | 'REPORT_CANCELLED'
  occurredAt: string
  changes: Change[]
  note: string | null
  contentFinal: string
  currentType: ReportType
  currentStatus: ReportStatus
  zone: ZoneSummary | null
  createdAt: string
  processingSeconds: number | null
}
export type AdminActivityReport = {
  actor: ActorSummary
  range: { from: string | null; to: string | null; timeZone: 'Asia/Seoul' }
  summary: AdminActivitySummary
  typeDistribution: TypeCount[]
  items: AdminActivityItem[]
  nextCursor: string | null
  asOf: string
}

export type FieldError = { location: 'body' | 'query' | 'path' | 'header'; path: (string | number)[]; code: string; detail: string }
export type ApiErrorBody = { status: number; code: string; detail: string; errors: FieldError[] }
