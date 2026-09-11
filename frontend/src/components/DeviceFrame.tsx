import type { ReactNode } from 'react'

/**
 * iOS 기기 베젤 프레임 — /demo 시연 전용 컴포넌트.
 *
 * design_handoff_oncue/디자인 시스템 규칙.md 4.8은 관리자를 "프레임 없는 브라우저 카드",
 * 스태프만 검정 베젤로 정의하지만, 이건 관리자 화면 플로우 문서 자체의 표현 방식이고
 * (dc.html은 흐름표 안에 여러 화면을 늘어놓는 용도라 카드 형태가 더 읽기 쉬움), /demo는
 * "iPad·iPhone에서 실제로 돌아가는 것처럼" 보여주는 게 목적이라 둘 다 실제 기기 베젤로 그린다.
 *
 * 내부 컨텐츠(iframe)는 실기기 해상도(태블릿 1180×820 / 모바일 390×780) 그대로 렌더링하고,
 * 화면에 다 들어오도록 `scale`만 CSS transform으로 줄인다 — 안의 앱은 실제 픽셀 기준으로 그려진다.
 */

type DeviceFrameProps = {
  /** 컨텐츠 영역 실제 px */
  contentWidth: number
  contentHeight: number
  bezel: number
  radius: number
  contentRadius: number
  /** 화면에 표시할 배율(내부 컨텐츠는 여전히 contentWidth/Height 기준으로 렌더링됨) */
  scale?: number
  variant: 'tablet' | 'phone'
  children: ReactNode
  className?: string
}

function DeviceFrame({
  contentWidth,
  contentHeight,
  bezel,
  radius,
  contentRadius,
  scale = 1,
  variant,
  children,
  className = '',
}: DeviceFrameProps) {
  const outerWidth = contentWidth + bezel * 2
  const outerHeight = contentHeight + bezel * 2

  return (
    <div
      className={className}
      style={{ width: outerWidth * scale, height: outerHeight * scale }}
    >
      <div
        className="relative bg-bezel shadow-frame"
        style={{
          width: outerWidth,
          height: outerHeight,
          borderRadius: radius,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {variant === 'tablet' ? (
          <div
            className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-black/50"
            style={{ width: 8, height: 8 }}
          />
        ) : (
          <div
            className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black"
            style={{ width: contentWidth * 0.32, height: 24 }}
          />
        )}
        <div
          className="absolute overflow-hidden bg-white"
          style={{
            left: bezel,
            top: bezel,
            width: contentWidth,
            height: contentHeight,
            borderRadius: contentRadius,
          }}
        >
          {children}
        </div>
        {variant === 'phone' && (
          <div
            className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white/70"
            style={{ width: contentWidth * 0.32, height: 4 }}
          />
        )}
      </div>
    </div>
  )
}

/** iPad(가로) — 관리자 태블릿 실기기 해상도 1180×820 */
export function IPadFrame({
  scale = 1,
  children,
  className,
}: {
  scale?: number
  children: ReactNode
  className?: string
}) {
  return (
    <DeviceFrame
      variant="tablet"
      contentWidth={1180}
      contentHeight={820}
      bezel={18}
      radius={36}
      contentRadius={20}
      scale={scale}
      className={className}
    >
      {children}
    </DeviceFrame>
  )
}

/** iPhone(세로) — 스태프 모바일 실기기 해상도 390×780 */
export function IPhoneFrame({
  scale = 1,
  children,
  className,
}: {
  scale?: number
  children: ReactNode
  className?: string
}) {
  return (
    <DeviceFrame
      variant="phone"
      contentWidth={390}
      contentHeight={780}
      bezel={10}
      radius={48}
      contentRadius={38}
      scale={scale}
      className={className}
    >
      {children}
    </DeviceFrame>
  )
}
