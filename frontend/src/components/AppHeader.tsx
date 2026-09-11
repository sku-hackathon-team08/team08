import { Avatar } from './Avatar'
import { BrandLogo } from './BrandLogo'

/**
 * ONCUE 관리자 대시보드 헤더 — design_handoff_oncue/COMPONENTS.md #10 "Header" 항목.
 * height 72 · 좌: 로고+행사명(▾) · 중앙: 탭(absolute 중앙 고정) · 우: 아바타+이름.
 * 구분선·배경 없음(디자인 시스템 규칙.md — 버블 배경 위에 바로 얹힘).
 */

export type HeaderTab = 'map' | 'my-report'

type AppHeaderProps = {
  eventName: string
  activeTab: HeaderTab
  onTabChange?: (tab: HeaderTab) => void
  userName: string
  className?: string
}

export function AppHeader({ eventName, activeTab, onTabChange, userName, className = '' }: AppHeaderProps) {
  return (
    <header className={['relative flex h-[72px] shrink-0 items-center justify-between px-[27px]', className].join(' ')}>
      <span className="flex items-center gap-[13px]">
        <BrandLogo size={27} wordmarkSize={27} />
        <span className="h-[21px] w-px bg-line" />
        <span className="text-t-body font-semibold text-ink-600">
          {eventName} <span className="text-ink-300">▾</span>
        </span>
      </span>

      <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-[19px]">
        <button
          type="button"
          onClick={() => onTabChange?.('map')}
          className={[
            'text-t-body pb-1',
            activeTab === 'map'
              ? 'border-b-2 border-primary font-bold text-primary'
              : 'font-semibold text-ink-400',
          ].join(' ')}
        >
          지도
        </button>
        <button
          type="button"
          onClick={() => onTabChange?.('my-report')}
          className={[
            'text-t-body pb-1',
            activeTab === 'my-report'
              ? 'border-b-2 border-primary font-bold text-primary'
              : 'font-semibold text-ink-400',
          ].join(' ')}
        >
          나의 리포트
        </button>
      </div>

      <span className="flex items-center gap-[10px]">
        <Avatar name={userName} size="sm" />
        <span className="text-t-body font-semibold text-ink-900">{userName}</span>
      </span>
    </header>
  )
}
