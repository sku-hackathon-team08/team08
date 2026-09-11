/**
 * ONCUE SortToggle — design_handoff_oncue/COMPONENTS.md #9.
 * "정렬" 라벨 칩 + 긴급순/최신순 토글, 활성만 primary 배경.
 */

export type SortValue = 'urgency' | 'recent'

type SortToggleProps = {
  value: SortValue
  onChange?: (value: SortValue) => void
  disabled?: boolean
}

export function SortToggle({ value, onChange, disabled = false }: SortToggleProps) {
  return (
    <div className={['flex items-center gap-[6px]', disabled ? 'opacity-45' : ''].join(' ')}>
      <span className="text-t-caption inline-flex h-[38px] items-center rounded-pill border-2 border-line bg-white/90 px-[18px] font-semibold text-ink-600">
        정렬
      </span>
      {(['urgency', 'recent'] as const).map((v) => (
        <button
          key={v}
          type="button"
          disabled={disabled}
          onClick={() => onChange?.(v)}
          className={[
            'text-t-caption inline-flex h-[38px] items-center rounded-pill border-2 px-[18px] font-bold',
            value === v ? 'border-primary bg-primary text-white shadow-cta' : 'border-line bg-white/90 text-ink-900',
          ].join(' ')}
        >
          {v === 'urgency' ? '긴급순' : '최신순'}
        </button>
      ))}
    </div>
  )
}
