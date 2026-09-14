/**
 * ONCUE StatCard — design_handoff_oncue/COMPONENTS.md #10.
 * bg primary/6 · radius15 · 상단 3px accent 테두리, 값도 같은 색.
 *
 * 2026-09-12: dc.html 실측은 전부 블루 계열(primary-ultra/primary/primary-light)이었지만
 * 사용자 요청으로 상태와 뜻이 맞는 카드는 기존 status 토큰(REPORT_STATUS_DISPLAY와 동일 계열,
 * StatusBadge.tsx 참고)을 쓰도록 바꿨다 — "완료"=status-done(초록), "취소"=status-cancel(회색).
 */
export type StatCardAccent = 'primary-ultra' | 'primary' | 'primary-light' | 'done' | 'muted'

const ACCENT_CLASS: Record<StatCardAccent, { text: string; border: string }> = {
  'primary-ultra': { text: 'text-primary-ultra', border: 'border-primary-ultra' },
  primary: { text: 'text-primary', border: 'border-primary' },
  'primary-light': { text: 'text-primary-light', border: 'border-primary-light' },
  done: { text: 'text-status-done', border: 'border-status-done' },
  // "취소"는 값 색·테두리 모두 status-cancel(흐린 회색)로 — 굳이 강조색을 쓰지 않는다.
  muted: { text: 'text-ink-500', border: 'border-status-cancel' },
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
