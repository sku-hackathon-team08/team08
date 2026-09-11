/**
 * ONCUE DotFilterChip — design_handoff_oncue/COMPONENTS.md #9.
 * height 38 · radius pill · bg white 90% · border 2px line · dot 9px 상태색.
 * 활성: bg primary + 흰 글씨 + shadow-cta. count 0이면 dot·글씨를 ink-400으로 감쇠.
 */

export type FilterKey = 'all' | 'urgent' | 'caution' | 'done' | 'unconfirmed'

const DOT_CLASS: Record<FilterKey, string | null> = {
  all: null,
  urgent: 'bg-status-urgent',
  caution: 'bg-status-caution',
  done: 'bg-status-done',
  unconfirmed: 'bg-status-normal',
}

const LABEL: Record<FilterKey, string> = {
  all: '전체',
  urgent: '긴급',
  caution: '주의',
  done: '완료',
  unconfirmed: '미확인',
}

type DotFilterChipProps = {
  status: FilterKey
  count: number
  active: boolean
  onClick?: () => void
}

export function DotFilterChip({ status, count, active, onClick }: DotFilterChipProps) {
  const dotClass = DOT_CLASS[status]
  const zero = count === 0

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'text-t-caption inline-flex h-[38px] items-center gap-[6px] rounded-pill border-2 px-[18px] font-bold',
        active
          ? 'border-primary bg-primary text-white shadow-cta'
          : ['border-line bg-white/90', zero ? 'text-ink-400' : 'text-ink-900'].join(' '),
      ].join(' ')}
    >
      {dotClass && (
        <i
          className={['inline-block rounded-full', active ? 'bg-white' : zero ? 'bg-ink-400' : dotClass].join(' ')}
          style={{ width: 9, height: 9 }}
        />
      )}
      {LABEL[status]} {count}
    </button>
  )
}
