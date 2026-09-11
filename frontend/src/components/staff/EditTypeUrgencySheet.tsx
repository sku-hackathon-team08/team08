import { REPORT_TYPE_DISPLAY, URGENCY_DISPLAY, type ReportType, type Urgency } from '../../types/report'
import { buttonClasses } from '../buttonStyles'

/**
 * S3-1(유형·위험도 직접 수정) — 관리자 화면 플로우(최종!).dc.html.
 * S3 위에 뜨는 바텀시트. 여기 칩은 admin의 SelectChip(rounded-[11px] 사각)과 달리
 * dc.html 실측이 radius:1000px 완전 pill이라 모양 자체가 달라서 재사용하지 않고
 * 이 화면 전용으로 작게 둔다 — 색 토큰(bg/border/text-type-*)은 SelectChip과 동일 규칙.
 */

const TYPES: ReportType[] = ['EMERGENCY', 'FACILITY', 'CROWD', 'LOST', 'OTHER']
const URGENCIES: Urgency[] = ['NORMAL', 'CAUTION', 'URGENT']

const TYPE_TOKEN: Record<ReportType, { bg: string; border: string; text: string }> = {
  EMERGENCY: { bg: 'bg-type-emergency/10', border: 'border-type-emergency/35', text: 'text-type-emergency-ink' },
  FACILITY: { bg: 'bg-type-facility/10', border: 'border-type-facility', text: 'text-type-facility-ink' },
  CROWD: { bg: 'bg-type-crowd/10', border: 'border-type-crowd/35', text: 'text-type-crowd-ink' },
  LOST: { bg: 'bg-type-lost/10', border: 'border-type-lost/35', text: 'text-type-lost-ink' },
  OTHER: { bg: 'bg-type-etc/7', border: 'border-type-etc/35', text: 'text-type-etc-ink' },
}

const URGENCY_BG: Record<Urgency, string> = {
  NORMAL: 'bg-status-normal',
  CAUTION: 'bg-status-caution',
  URGENT: 'bg-status-urgent',
}

export function EditTypeUrgencySheet({
  type,
  urgency,
  aiUrgency,
  onChangeType,
  onChangeUrgency,
  onApply,
}: {
  type: ReportType
  urgency: Urgency
  /** 원래 AI 1차 추정값 — 시트 안내문에 "AI 1차 추정: 주의"처럼 그대로 보여준다 */
  aiUrgency: Urgency
  onChangeType: (t: ReportType) => void
  onChangeUrgency: (u: Urgency) => void
  onApply: () => void
}) {
  return (
    <>
      <div className="absolute inset-0 z-40 bg-ink-900/35" />
      <div className="absolute inset-x-0 bottom-0 z-50 flex flex-col gap-[18px] rounded-t-[30px] bg-white px-[24px] pb-[30px] pt-[24px] shadow-sheet">
        <span className="text-m-title font-extrabold text-ink-900">유형 · 위험도 수정</span>

        <div className="flex flex-col gap-[8px]">
          <span className="text-m-caption font-bold text-ink-600">유형</span>
          <div className="flex flex-wrap gap-[8px]">
            {TYPES.map((t) => {
              const c = TYPE_TOKEN[t]
              const selected = t === type
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onChangeType(t)}
                  className={[
                    'flex h-[36px] items-center rounded-pill border px-[15px] text-m-micro font-semibold',
                    c.bg,
                    c.text,
                    selected ? c.border.replace('/35', '') : c.border,
                  ].join(' ')}
                >
                  {REPORT_TYPE_DISPLAY[t].label}
                  {selected && ' ✓'}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-[8px]">
          <span className="text-m-caption font-bold text-ink-600">
            위험도 (AI 1차 추정: {URGENCY_DISPLAY[aiUrgency].label})
          </span>
          <div className="flex gap-[8px]">
            {URGENCIES.map((u) => {
              const selected = u === urgency
              return (
                <button
                  key={u}
                  type="button"
                  onClick={() => onChangeUrgency(u)}
                  className={[
                    'flex h-[45px] flex-1 items-center justify-center rounded-[12px] text-m-caption font-bold',
                    selected ? [URGENCY_BG[u], 'text-white'].join(' ') : 'bg-surface-chip text-ink-600',
                  ].join(' ')}
                >
                  {URGENCY_DISPLAY[u].label}
                  {selected && ' ✓'}
                </button>
              )
            })}
          </div>
          <span className="text-m-micro text-ink-400">최종 확정은 관리자 판단입니다 — AI 추정은 참고용입니다</span>
        </div>

        <button type="button" onClick={onApply} className={buttonClasses({ variant: 'primary', size: 'md', fullWidth: true })}>
          적용
        </button>
      </div>
    </>
  )
}
