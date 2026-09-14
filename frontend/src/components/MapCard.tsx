import type { RefObject } from 'react'
import { buttonClasses } from './buttonStyles'

/**
 * 관리자 지도 카드 — 02 지도 대시보드 좌측 58% 영역 / 03~05 상세 화면 좌측 46~58% 영역.
 *
 * 2026-09-12: VWorld API 키를 받아서 실지도 연동 시작(docs/features/command-dashboard.md의
 * "이번 범위 제외"는 접근 경로 안내·구역 판정 얘기였고, 지도 표시 자체는 제외 대상이
 * 아니었다 — docs/api/demo-map.md 참고). `showRealMap`이 있으면 그라디언트 자리표시자
 * 대신 실지도가 들어갈 빈 슬롯을 그리고, 기존 오버레이 UI(라벨·컨트롤·CTA·출처 바)는
 * 그대로 위에 얹는다 — 없으면 예전처럼 플레이스홀더만 보여준다(지도 데이터 로딩 실패 시
 * 폴백으로도 재사용).
 *
 * 실지도(VWorldMap)는 이 컴포넌트가 직접 그리지 않는다 — 브이월드 SDK는 페이지에
 * map.start()를 두 번째 부르면 내부 싱글턴이 깨지는 제약이 있어(VWorldMap.tsx 주석 참고)
 * 인스턴스를 하나만 만들어 두고 화면(대시보드 58%/상세 46%)에 따라 위치만 옮겨야 한다.
 * 그래서 여기서는 실지도가 들어갈 자리를 `mapSlotRef`로 알려주기만 하고, 실제 VWorldMap은
 * 상위(AdminHomePage)가 그 슬롯 좌표를 읽어 화면 밖에서 겹쳐 그린다.
 *
 * `compact`(04/05 신고 상세용)일 때는 dc.html 원본대로 정보카드 + 핀 하나만 그리고
 * 컨트롤 스택·고도 뱃지·직접 신고 CTA·출처 바를 뺀다(상세 화면 지도엔 그 요소들이 없음).
 */

export type MapPinData = {
  id: string
  /** 카드 내부 상대 위치(%) */
  top: number
  left: number
  colorClass: string
  shape?: 'circle' | 'square'
  dimmed?: boolean
}

export type MapCardState = 'ready' | 'loading' | 'error' | 'empty'

type ConnectorProps = {
  /** 현재 위치(관리자) — 파란 점 + "현재 위치" 라벨 */
  from: { top: number; left: number }
  /** 선택된 신고 위치 — 크게 강조된 핀 + 라벨 */
  to: { top: number; left: number; label: string; colorClass: string }
}

type MapCardProps = {
  state: MapCardState
  locationLabel?: string
  pins?: MapPinData[]
  /** 03: 현재 위치 → 선택한 신고 위치 점선 연결선 */
  connector?: ConnectorProps
  /** 04/05: 정보카드 + 핀 하나만(컨트롤·CTA·출처 바 없음) */
  compact?: boolean
  /** compact일 때 보여줄 단일 핀 */
  singlePin?: { top: number; left: number; colorClass: string }
  lastSyncLabel?: string
  onDirectReport?: () => void
  className?: string
  /** 있으면 그라디언트 자리표시자 대신 실지도가 들어갈 빈 슬롯을 그린다 */
  showRealMap?: boolean
  /** showRealMap일 때 그 슬롯의 DOM 좌표를 상위로 알려주는 ref — 위 파일 설명 참고 */
  mapSlotRef?: RefObject<HTMLDivElement | null>
}

const CONTROL_ICONS = ['▲', '◎', '+', '−', '⤢']

export function MapCard({
  state,
  locationLabel = '상암월드컵경기장',
  pins = [],
  connector,
  compact = false,
  singlePin,
  lastSyncLabel,
  onDirectReport,
  className = '',
  showRealMap = false,
  mapSlotRef,
}: MapCardProps) {
  return (
    <div
      className={[
        'relative overflow-hidden rounded-md shadow-map',
        showRealMap ? '' : 'bg-[linear-gradient(160deg,rgb(214,224,214)_0%,rgb(197,213,199)_35%,rgb(180,202,190)_65%,rgb(162,190,183)_100%)]',
        // showRealMap일 때 카드 자체를 pointer-events-none으로 뚫어야 한다 — 슬롯 div만
        // 뚫어도(바로 아래) 그 부모인 이 카드 루트 자체가 여전히 pointer-events:auto라
        // 클릭·드래그를 그대로 가로채서, 화면상 겹쳐진 진짜 지도(AdminHomePage가 띄우는
        // VWorldMap)까지 이벤트가 전달되지 않는다(2026-09-12 실제 드래그로 확인 — 카드
        // 루트가 elementFromPoint의 타깃으로 잡혔다). 그래서 이 안의 실제 클릭 가능한 요소
        // (관리자 직접 신고 버튼)에만 다시 pointer-events-auto를 되살린다.
        showRealMap ? 'pointer-events-none' : '',
        className,
      ].join(' ')}
    >
      {showRealMap && <div ref={mapSlotRef} className="absolute inset-0 z-0" />}

      {state === 'error' && <div className="absolute inset-0 z-10 bg-white/55" />}

      <div className="absolute left-[15px] top-[15px] z-20 flex flex-col gap-[2px] rounded-[17px] bg-white/92 px-[19px] py-[11px] shadow-panel">
        <span className="flex items-center gap-1 text-[19px] font-bold text-ink-900">
          <i className="inline-block h-[15px] w-[11px] rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-primary" />
          VWorld 지도
        </span>
        <span className="text-t-caption text-ink-500">
          {state === 'error' && lastSyncLabel ? `마지막 동기화 ${lastSyncLabel}` : locationLabel}
        </span>
      </div>

      {compact ? (
        !showRealMap && singlePin && (
          <i
            className={['absolute z-20 rounded-full border-[6px] border-white shadow-[0_0_0_8px_rgba(0,0,0,0.08)]', singlePin.colorClass].join(' ')}
            style={{ top: `${singlePin.top}%`, left: `${singlePin.left}%`, width: 27, height: 27 }}
          />
        )
      ) : (
        <>
          {state !== 'loading' && (
            <div className="absolute right-[15px] top-[15px] z-20 flex flex-col gap-[8px]">
              {CONTROL_ICONS.map((icon) => (
                <span
                  key={icon}
                  className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-white/94 text-[17px] font-bold text-ink-900 shadow-panel"
                >
                  {icon}
                </span>
              ))}
            </div>
          )}

          {state === 'loading' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-[13px]">
              <div className="flex gap-[9px]">
                <i className="inline-block h-[13px] w-[13px] rounded-full bg-primary" />
                <i className="inline-block h-[13px] w-[13px] rounded-full bg-primary/45" />
                <i className="inline-block h-[13px] w-[13px] rounded-full bg-primary/18" />
              </div>
              <span className="text-t-caption font-semibold text-ink-500">지도를 불러오는 중</span>
            </div>
          )}

          {state === 'empty' && (
            <span className="absolute left-1/2 top-[44%] z-20 -translate-x-1/2 -translate-y-1/2 rounded-pill bg-white/90 px-[23px] py-[8px] text-t-caption font-semibold text-ink-500 shadow-panel">
              표시할 신고 없음 · 구역만 표시 중
            </span>
          )}

          {state === 'error' && (
            <span className="absolute left-1/2 top-[46%] z-20 -translate-x-1/2 -translate-y-1/2 rounded-pill bg-white/92 px-[23px] py-[8px] text-t-caption font-semibold text-ink-500 shadow-panel">
              {lastSyncLabel ? `${lastSyncLabel} 기준 화면입니다` : '이전 화면입니다'}
            </span>
          )}

          {!showRealMap &&
            state === 'ready' &&
            pins.map((pin) => (
              <i
                key={pin.id}
                className={[
                  'absolute z-20 border-2 border-white shadow-[0_1px_3px_rgba(0,0,0,0.3)]',
                  pin.shape === 'square' ? 'rounded-[4px]' : 'rounded-full',
                  pin.colorClass,
                  pin.dimmed ? 'opacity-60' : '',
                ].join(' ')}
                style={{ top: `${pin.top}%`, left: `${pin.left}%`, width: 20, height: 20 }}
              />
            ))}

          {!showRealMap && state === 'ready' && connector && (
            <>
              <span
                className="absolute z-10 border-t-2 border-dashed border-primary"
                style={{
                  top: `${(connector.from.top + connector.to.top) / 2}%`,
                  left: `${Math.min(connector.from.left, connector.to.left)}%`,
                  width: `${Math.abs(connector.to.left - connector.from.left)}%`,
                }}
              />
              <i
                className="absolute z-20 rounded-full border-2 border-white bg-primary"
                style={{ top: `${connector.from.top}%`, left: `${connector.from.left}%`, width: 17, height: 17 }}
              />
              <span
                className="absolute z-20 rounded-[9px] bg-white px-[9px] py-[4px] text-[15px] font-bold text-primary shadow-[0_1px_3px_rgba(0,0,0,0.15)]"
                style={{ top: `${connector.from.top - 8}%`, left: `${connector.from.left - 6}%` }}
              >
                현재 위치
              </span>
              <i
                className={['absolute z-20 rounded-full border-[3px] border-white', connector.to.colorClass].join(' ')}
                style={{
                  top: `${connector.to.top}%`,
                  left: `${connector.to.left}%`,
                  width: 27,
                  height: 27,
                  boxShadow: '0 0 0 8px rgba(255,66,66,0.25)',
                }}
              />
              <span
                className={['absolute z-20 rounded-[9px] px-[11px] py-[4px] text-[15px] font-bold text-white', connector.to.colorClass].join(' ')}
                style={{ top: `${connector.to.top + 9}%`, left: `${connector.to.left - 5}%` }}
              >
                {connector.to.label}
              </span>
            </>
          )}

          <span className="absolute bottom-[46px] right-[15px] z-20 flex h-[30px] items-center rounded-[8px] bg-ink-900/72 px-[13px] text-[13px] font-medium text-white">
            내려다보는 높이 152 m · 각도 40°
          </span>

          {state === 'ready' && (
            <button
              type="button"
              onClick={onDirectReport}
              className={[buttonClasses({ variant: 'primary', size: 'sm' }), 'absolute bottom-[46px] left-[15px] z-20 pointer-events-auto'].join(' ')}
            >
              + 관리자 직접 신고
            </button>
          )}

          <div className="absolute inset-x-0 bottom-0 z-20 flex h-[34px] items-center justify-between bg-[#262628] px-[15px]">
            <span className="text-[13px] font-semibold text-white/80">국토교통부 브이월드</span>
            <span className="text-[13px] font-medium text-status-caution/90">
              ※ 연속지적도를 포함한 모든 주제도는 참고용으로만 사용하시기 바랍니다.
            </span>
          </div>
        </>
      )}
    </div>
  )
}
