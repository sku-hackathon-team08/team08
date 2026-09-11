import { REPORT_TYPE_DISPLAY, type ReportType } from '../types/report'

/**
 * ONCUE TypeBadge — design_handoff_oncue/COMPONENTS.md #3.
 * type 축(신고 유형). status 축(StatusBadge)과 절대 혼용하지 않는다.
 * 배경 type-{x} 10% · border 1px type-{x} · 글씨 type-{x}-ink
 */

const TOKEN_CLASSES: Record<ReportType, { bg: string; border: string; text: string }> = {
  EMERGENCY: { bg: 'bg-type-emergency/10', border: 'border-type-emergency', text: 'text-type-emergency-ink' },
  FACILITY: { bg: 'bg-type-facility/10', border: 'border-type-facility', text: 'text-type-facility-ink' },
  CROWD: { bg: 'bg-type-crowd/10', border: 'border-type-crowd', text: 'text-type-crowd-ink' },
  LOST: { bg: 'bg-type-lost/10', border: 'border-type-lost', text: 'text-type-lost-ink' },
  OTHER: { bg: 'bg-type-etc/10', border: 'border-type-etc', text: 'text-type-etc-ink' },
}

type TypeBadgeProps = {
  type: ReportType
  /** sm: 리스트, md: 폼 · @default 'sm' */
  size?: 'sm' | 'md'
  className?: string
}

export function TypeBadge({ type, size = 'sm', className = '' }: TypeBadgeProps) {
  const c = TOKEN_CLASSES[type]
  const sizeClasses = size === 'sm' ? 'h-[38px] rounded-[11px] text-[15px]' : 'h-[46px] rounded-[13px] text-[17px]'
  return (
    <span
      className={[
        'inline-flex items-center border px-4 font-bold',
        sizeClasses,
        c.bg,
        c.border,
        c.text,
        className,
      ].join(' ')}
    >
      {REPORT_TYPE_DISPLAY[type].label}
    </span>
  )
}
