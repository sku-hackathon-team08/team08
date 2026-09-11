import { REPORT_TYPE_DISPLAY, type ReportType } from '../types/report'

/**
 * ONCUE SelectChip — design_handoff_oncue/COMPONENTS.md #4.
 * 선택: 테두리 원색 + 글씨 ink + " ✓" suffix. 미선택: 테두리 35% + 글씨 75%.
 * 11(관리자 직접 신고)의 유형 선택에 쓰인다.
 */

const TOKEN_CLASSES: Record<ReportType, { bg: string; borderSelected: string; borderUnselected: string; textSelected: string }> = {
  EMERGENCY: {
    bg: 'bg-type-emergency/10',
    borderSelected: 'border-type-emergency',
    borderUnselected: 'border-type-emergency/35',
    textSelected: 'text-type-emergency-ink',
  },
  FACILITY: {
    bg: 'bg-type-facility/8',
    borderSelected: 'border-type-facility',
    borderUnselected: 'border-type-facility/35',
    textSelected: 'text-type-facility-ink',
  },
  CROWD: {
    bg: 'bg-type-crowd/8',
    borderSelected: 'border-type-crowd',
    borderUnselected: 'border-type-crowd/35',
    textSelected: 'text-type-crowd-ink',
  },
  LOST: {
    bg: 'bg-type-lost/8',
    borderSelected: 'border-type-lost',
    borderUnselected: 'border-type-lost/35',
    textSelected: 'text-type-lost-ink',
  },
  OTHER: {
    bg: 'bg-type-etc/7',
    borderSelected: 'border-type-etc',
    borderUnselected: 'border-type-etc/35',
    textSelected: 'text-type-etc-ink',
  },
}

type SelectChipProps = {
  type: ReportType
  selected: boolean
  onSelect: () => void
}

export function SelectChip({ type, selected, onSelect }: SelectChipProps) {
  const c = TOKEN_CLASSES[type]
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'flex h-[42px] items-center rounded-[11px] border px-[17px] text-[17px] font-bold',
        c.bg,
        selected ? [c.borderSelected, c.textSelected].join(' ') : [c.borderUnselected, c.textSelected, 'opacity-75'].join(' '),
      ].join(' ')}
    >
      {REPORT_TYPE_DISPLAY[type].label}
      {selected && ' ✓'}
    </button>
  )
}
