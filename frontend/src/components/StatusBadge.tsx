import { REPORT_STATUS_DISPLAY, type ReportStatus } from '../types/report'

/**
 * ONCUE StatusBadge — design_handoff_oncue/COMPONENTS.md #2.
 * status 축(처리 상태/위험도). type 축(TypeBadge)과 절대 혼용하지 않는다.
 *
 * 'SUPPORT'는 실제 ReportStatus가 아니라 support_requested 플래그를 같은 뱃지
 * 모양으로 보여주기 위한 화면 전용 값이다(디자인 인벤토리가 같은 컴포넌트로 묶어 씀).
 */

export type StatusBadgeStatus = ReportStatus | 'SUPPORT'

const DISPLAY: Record<StatusBadgeStatus, { label: string; token: string }> = {
  ...REPORT_STATUS_DISPLAY,
  SUPPORT: { label: '지원요청', token: 'status-support' },
}

const TOKEN_BG_CLASS: Record<string, string> = {
  'status-urgent': 'bg-status-urgent',
  'status-caution': 'bg-status-caution',
  'status-progress': 'bg-status-progress',
  'status-done': 'bg-status-done',
  'status-cancel': 'bg-status-cancel',
  'status-support': 'bg-status-support',
}

const TOKEN_SOFT_BG_CLASS: Record<string, string> = {
  'status-urgent': 'bg-status-urgent/12',
  'status-caution': 'bg-status-caution/12',
  'status-progress': 'bg-status-progress/12',
  'status-done': 'bg-status-done/12',
  'status-cancel': 'bg-status-cancel/12',
  'status-support': 'bg-status-support/12',
}

const TOKEN_TEXT_CLASS: Record<string, string> = {
  'status-urgent': 'text-status-urgent',
  'status-caution': 'text-status-caution',
  'status-progress': 'text-status-progress',
  'status-done': 'text-status-done',
  'status-cancel': 'text-status-cancel',
  'status-support': 'text-status-support',
}

type StatusBadgeProps = {
  status: StatusBadgeStatus
  /** @default 'soft' */
  tone?: 'solid' | 'soft'
  count?: number
  className?: string
}

export function StatusBadge({ status, tone = 'soft', count, className = '' }: StatusBadgeProps) {
  const { label, token } = DISPLAY[status]
  return (
    <span
      className={[
        'inline-flex h-[30px] items-center rounded-[9px] px-[13px] text-[15px] font-bold',
        tone === 'solid' ? [TOKEN_BG_CLASS[token], 'text-white'] : [TOKEN_SOFT_BG_CLASS[token], TOKEN_TEXT_CLASS[token]],
        className,
      ]
        .flat()
        .join(' ')}
    >
      {label}
      {typeof count === 'number' && <span className="ml-1 opacity-70">{count}</span>}
    </span>
  )
}
