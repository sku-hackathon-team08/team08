import { REPORT_TYPE_DISPLAY, type Report } from '../types/report'
import type { StaffReportSummary, StaffTimelineEntry } from '../types/staffReport'
import type { ApiMapPin, ApiReportCard, ApiReportDetail, ApiStaffReport } from './types'
import type { MapPinData } from '../components/MapCard'

/**
 * 백엔드 응답(camelCase DTO, api/types.ts)을 화면이 이미 쓰고 있는 평평한 Report로 바꾼다.
 * 컴포넌트(ReportCard/ReportDetailPanel/MyReportView/FilterBar 등)는 전혀 안 건드리고
 * API 경계에서만 모양을 맞추는 방식 — 2026-09-12 API 감사에서 확인한 차이들:
 *
 * - type/urgency: 백엔드는 {value,source,confirmedBy,confirmedAt} 객체 → .value만 뽑는다.
 * - 원문: contentFinal → message.
 * - 위치: place 필드가 없다. zone(이번 범위에서 항상 null)이 있으면 그 이름, 없으면
 *   "현재 위치"로 통일 표기(2026-09-12 확정 — 좌표를 그대로 노출하지 않는다).
 * - 담당자: claimedBy{id,name} → assigneeName은 name만, 담당자 본인 여부는 이 어댑터가
 *   아니라 호출부에서 claimedBy.id로 직접 비교해야 한다(별도로 rawClaimedById를 남긴다).
 * - 지원요청: supportRequestId(uuid|null) → supportRequested는 null 아님 여부로 파생.
 * - 종결시각: resolvedAt ?? cancelledAt → closedAt.
 */

type ApiReportLike = ApiReportCard | ApiReportDetail | ApiStaffReport

function placeLabel(report: ApiReportLike): string {
  return report.zone?.name ?? '현재 위치'
}

function resolveNote(report: ApiReportLike): string | undefined {
  return 'resolveNote' in report ? (report.resolveNote ?? undefined) : undefined
}

function cancelReason(report: ApiReportLike): string | undefined {
  return 'cancelReason' in report ? (report.cancelReason ?? undefined) : undefined
}

/**
 * 종결 시각. ApiReportCard(목록 요약)엔 resolvedAt/cancelledAt이 아예 없다 —
 * ReportDetail·StaffReport에만 있다. 목록 카드에서는 그래서 closedAt이 항상 undefined인 채로
 * 넘어간다(MyReportView는 상세를 따로 불러오기 전까진 소요시간을 못 보여준다 — 다음 단계
 * 과제로 남긴다).
 */
function closedAt(report: ApiReportLike): string | undefined {
  const resolvedAt = 'resolvedAt' in report ? report.resolvedAt : undefined
  const cancelledAt = 'cancelledAt' in report ? report.cancelledAt : undefined
  return resolvedAt ?? cancelledAt ?? undefined
}

export function fromApiReport(report: ApiReportLike): Report {
  const claimedBy = 'claimedBy' in report ? report.claimedBy : null
  return {
    id: report.id,
    version: 'version' in report ? report.version : undefined,
    type: report.type.value,
    urgency: report.urgency.value,
    status: report.status,
    message: report.contentFinal,
    place: placeLabel(report),
    assigneeName: claimedBy?.name,
    assigneeId: claimedBy?.id,
    supportRequested: 'supportRequestId' in report ? report.supportRequestId !== null : false,
    createdAt: report.createdAt,
    isUnacknowledged: 'isUnacknowledged' in report ? report.isUnacknowledged : undefined,
    resolveNote: resolveNote(report),
    cancelReason: cancelReason(report),
    closedAt: closedAt(report),
  }
}

/**
 * ApiStaffReport → StaffReportSummary(S1/S4 화면용). 실제 응답엔 처리 메모(note) 텍스트가
 * 없어서(그건 ReportDetail 전용 필드라 관리자만 봄) 타임라인 항목의 note는 항상 비운다 —
 * 목데이터 예시에 있던 "박OO 관리자 확인 · 처리 중" 같은 문구는 재현하지 않는다.
 */
export function fromApiStaffReport(report: ApiStaffReport): StaffReportSummary {
  const timeline: StaffTimelineEntry[] = [{ status: 'RECEIVED', at: report.createdAt }]
  if (report.claimedAt) timeline.push({ status: 'IN_PROGRESS', at: report.claimedAt })
  if (report.resolvedAt) timeline.push({ status: 'RESOLVED', at: report.resolvedAt })
  if (report.cancelledAt) timeline.push({ status: 'CANCELLED', at: report.cancelledAt })

  return {
    id: report.id,
    title: REPORT_TYPE_DISPLAY[report.type.value].label,
    message: report.contentFinal,
    type: report.type.value,
    urgency: report.urgency.value,
    status: report.status,
    createdAt: report.createdAt,
    timeline,
  }
}

export function fromApiMapPin(pin: ApiMapPin, index: number): MapPinData {
  const colorClass =
    pin.status === 'IN_PROGRESS'
      ? 'bg-status-progress'
      : pin.status === 'RESOLVED'
        ? 'bg-status-done'
        : pin.urgency.value === 'URGENT'
          ? 'bg-status-urgent'
          : pin.urgency.value === 'CAUTION'
            ? 'bg-status-caution'
            : 'bg-status-normal'
  // 실제 VWorld 지도 연동 전이라 좌표를 화면 % 위치로 정확히 투영할 방법이 없다 — 지금은
  // MapCard 플레이스홀더 위에 겹치지 않게 흩뿌리는 임시 배치만 한다(다음 작업: 실제 지도).
  const top = 30 + ((index * 17) % 45)
  const left = 20 + ((index * 23) % 55)
  return { id: pin.id, top, left, colorClass }
}
