import type { ReactNode } from 'react'

/**
 * ONCUE Modal 공용 오버레이+패널 — design_handoff_oncue/COMPONENTS.md #8.
 * 09/10/11 실측 대조 결과 overlay 투명도·패널 width는 COMPONENTS.md의 confirm/warning
 * 구분(760/646)이 아니라 화면마다 dc.html에 실제로 쓰인 값이 서로 달라(09/10=760, 11=798),
 * 고정 kind enum 대신 인스턴스별로 그 값을 그대로 받는 형태로 만들었다.
 * panel: radius 30 · padding 38 · shadow-modal (여기까지는 세 모달 공통, dc.html과 일치).
 */

type ModalProps = {
  open: boolean
  onClose: () => void
  /** dc.html 실측: 완료/취소 확인=0.45, 직접 신고=0.35 */
  overlayOpacity?: number
  /** 패널 실제 px 너비(태블릿 스케일 환산값) */
  width: number
  gap?: number
  padding?: number
  children: ReactNode
}

export function Modal({ open, onClose, overlayOpacity = 0.45, width, gap = 23, padding = 38, children }: ModalProps) {
  if (!open) return null

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `rgba(23,23,23,${overlayOpacity})` }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[90%] flex-col overflow-y-auto rounded-[30px] bg-white shadow-modal"
        style={{ width, gap, padding }}
      >
        {children}
      </div>
    </div>
  )
}
