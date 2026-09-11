/**
 * ONCUE StatCard — design_handoff_oncue/COMPONENTS.md #10.
 * bg primary/6 · radius15 · 상단 3px accent 테두리, 값도 같은 색.
 */
export type StatCardAccent = 'primary-ultra' | 'primary' | 'primary-light' | 'muted'

const ACCENT_CLASS: Record<StatCardAccent, { text: string; border: string }> = {
  'primary-ultra': { text: 'text-primary-ultra', border: 'border-primary-ultra' },
  primary: { text: 'text-primary', border: 'border-primary' },
  'primary-light': { text: 'text-primary-light', border: 'border-primary-light' },
  // dc.html 실측: "취소" 카드는 테두리색은 primary-light인데 값 색은 흐린 회색(ink-500)이다.
  muted: { text: 'text-ink-500', border: 'border-primary-light' },
}

type StatCardProps = {
  value: string | number
  label: string
  accent: StatCardAccent
}

export function StatCard({ value, label, accent }: StatCardProps) {
  const c = ACCENT_CLASS[accent]
  return (
    <div className={['flex flex-col gap-[4px] rounded-[15px] border-t-[3px] bg-primary/6 p-[15px]', c.border].join(' ')}>
      <div className={['text-[28px] font-extrabold', c.text].join(' ')}>{value}</div>
      <div className="text-[15px] font-semibold text-ink-600">{label}</div>
    </div>
  )
}
