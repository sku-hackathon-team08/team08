import { useState } from 'react'

/**
 * 개발용 상태 전환 패널 — 실제 디자인엔 없는 스캐폴딩이다.
 * API 연동 전 화면의 상태 분기(loading/error/empty/... )를 눈으로 확인하려고 화면마다
 * 재사용한다. 진짜 메뉴로 오해하지 않도록 본문 레이아웃 밖에 떠 있는 카드로 그리고,
 * 접었다 펼 수 있게 한다. API 연동 시 화면에서 이 컴포넌트 자체를 뗀다.
 */

type DevStatePanelProps<T extends string> = {
  label: string
  value: T
  options: readonly T[]
  optionLabel: Record<T, string>
  onChange: (value: T) => void
}

export function DevStatePanel<T extends string>({ label, value, options, optionLabel, onChange }: DevStatePanelProps<T>) {
  const [open, setOpen] = useState(true)

  // fixed가 아니라 absolute — 부모(각 화면의 실제 콘텐츠 박스, position:relative)를 기준으로 뜬다.
  // 관리자 화면은 태블릿 비율로 고정된 박스 안에 레터박스 처리되므로, 뷰포트 기준 fixed를 쓰면
  // 창이 그 비율과 다를 때 패널이 실제 화면 밖(레터박스 여백)에 떠버린다.
  return (
    <div className="absolute bottom-3 right-3 z-50 font-sans">
      {open ? (
        <div className="flex items-center gap-1 rounded-lg border border-dashed border-status-caution bg-ink-900/90 px-2 py-1.5 shadow-modal">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-wide text-status-caution">dev · {label}</span>
          {options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              className={[
                'rounded px-2 py-0.5 text-[11px]',
                value === o ? 'bg-status-caution text-ink-900' : 'text-white/70 hover:text-white',
              ].join(' ')}
            >
              {optionLabel[o]}
            </button>
          ))}
          <button type="button" onClick={() => setOpen(false)} className="ml-1 text-white/50 hover:text-white" aria-label="패널 접기">
            ×
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full bg-ink-900/90 px-3 py-1.5 text-[11px] font-bold text-status-caution shadow-modal"
        >
          dev
        </button>
      )}
    </div>
  )
}
