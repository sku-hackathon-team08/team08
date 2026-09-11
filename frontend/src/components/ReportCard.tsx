import { StatusBadge } from './StatusBadge'
import { REPORT_TYPE_DISPLAY, primaryDisplayLabel, primaryDisplayToken, type Report } from '../types/report'

/**
 * ONCUE ReportCard ★ 핵심 — design_handoff_oncue/COMPONENTS.md #6.
 * 카드 bg white · radius-lg(20) · padding 17/19 · shadow-card · border 2px 위험도색 22%.
 *
 * 1행 라벨·색·테두리는 위험도가 아니라 primaryDisplayToken/Label을 따른다 — dc.html의
 * "처리중 · 분실" 카드로 실측 확인: 위험도는 NORMAL(회색)이어도 상태가 IN_PROGRESS면
 * "처리중"이라는 라벨과 status-progress(파랑) 색·테두리로 나온다(위험도 라벨/색이 그대로
 * 남는 건 RECEIVED일 때뿐).
 */

const TOKEN_BORDER_CLASS: Record<string, string> = {
  'status-normal': 'border-status-normal/22',
  'status-caution': 'border-status-caution/22',
  'status-urgent': 'border-status-urgent/22',
  'status-progress': 'border-status-progress/22',
  'status-done': 'border-status-done/22',
  'status-cancel': 'border-status-cancel/22',
}

const TOKEN_TEXT_CLASS: Record<string, string> = {
  'status-normal': 'text-status-normal',
  'status-caution': 'text-status-caution',
  'status-urgent': 'text-status-urgent',
  'status-progress': 'text-status-progress',
  'status-done': 'text-status-done',
  'status-cancel': 'text-status-cancel',
}

export type ReportCardState = 'default' | 'selected' | 'locked' | 'dimmed'

type ReportCardProps = {
  report: Report
  state?: ReportCardState
  /** locked일 때 선점한 관리자 이름 — 클릭 시 "이미 {이름}님이 확인했습니다" 안내에 쓰인다 */
  lockedByName?: string
  onOpen?: () => void
  onDelete?: () => void
}

export function ReportCard({ report, state = 'default', lockedByName, onOpen, onDelete }: ReportCardProps) {
  const primaryToken = primaryDisplayToken(report.status, report.urgency)
  const borderClass = report.supportRequested ? 'border-status-support' : TOKEN_BORDER_CLASS[primaryToken]

  const trailingBadge =
    state === 'locked' ? (
      <span className="text-t-caption rounded-[9px] bg-ink-300 px-[13px] py-1 font-bold text-white">잠금</span>
    ) : report.supportRequested ? (
      <StatusBadge status="SUPPORT" tone="soft" />
    ) : report.status === 'IN_PROGRESS' && report.assigneeName ? (
      <span className="text-t-caption rounded-[6px] bg-status-progress/12 px-[8px] py-[3px] font-bold text-status-progress">
        담당: {report.assigneeName}
      </span>
    ) : (
      <StatusBadge status={report.status} tone="soft" />
    )

  return (
    <div
      role="button"
      tabIndex={0}
      title={state === 'locked' && lockedByName ? `이미 ${lockedByName}님이 확인했습니다` : undefined}
      onClick={onOpen}
      className={[
        'relative flex flex-col gap-[8px] rounded-lg border-2 bg-white px-[19px] py-[17px] shadow-card',
        borderClass,
        state === 'selected' ? 'border-[3px] border-primary shadow-panel' : '',
        state === 'locked' ? 'opacity-55' : '',
        state === 'dimmed' ? 'opacity-60' : '',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDelete?.()
        }}
        aria-label="목록에서 삭제"
        className="absolute right-[13px] top-[13px] flex h-[28px] w-[28px] items-center justify-center rounded-full bg-surface-chip text-ink-600"
      >
        ×
      </button>

      <div className="flex items-baseline justify-between pr-8">
        <span className={['text-[15px] font-bold', TOKEN_TEXT_CLASS[primaryToken]].join(' ')}>
          {primaryDisplayLabel(report.status, report.urgency)} · {REPORT_TYPE_DISPLAY[report.type].label}
        </span>
        <span className="text-[14px] font-medium text-ink-300">
          {new Date(report.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
        </span>
      </div>

      <p className="line-clamp-2 text-t-body font-medium text-ink-900">{report.message}</p>

      <div className="flex items-center justify-between">
        <span className="flex items-center gap-[6px] text-[14px] font-medium text-ink-600">
          <i className="inline-block h-[9px] w-[7px] rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-ink-400" />
          {report.place}
        </span>
        {trailingBadge}
      </div>
    </div>
  )
}
