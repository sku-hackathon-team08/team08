import { useEffect, useState } from 'react'
import { DevNavPanel } from '../components/DevNavPanel'
import { IPadFrame, IPhoneFrame } from '../components/DeviceFrame'
import { IPAD_OUTER, IPHONE_OUTER } from '../components/deviceFrameSizes'

/** 두 프레임 사이 간격(gap-10)·바깥 여백(p-10)·캡션 높이 — 아래 훅의 여유 공간 계산에 그대로 맞춰 쓴다. */
const LAYOUT_GAP = 40
const LAYOUT_PADDING = 40
const CAPTION_RESERVED = 40

/**
 * 2026-09-12: F11 전체화면·100% 배율로 발표할 때 아이패드가 위쪽에 붕 뜨고 아이폰이
 * 상대적으로 더 커 보이는 문제 — 예전엔 스케일을 0.55/1로 고정해서 실기기 화면비 그대로
 * 두다 보니 세로로 긴 폰 프레임(외곽 800px)이 태블릿 프레임(외곽 856px×0.55≈471px)보다
 * 화면에서 더 커졌다. 두 프레임의 **외곽 높이를 항상 같게** 맞추면(태블릿이 가로로 넓고
 * 폰이 세로로 좁은 실제 기기 비율은 그대로 유지하면서) 나란히 놨을 때 균형 있게 보인다.
 * 창 크기에 맞춰 매번 다시 계산해서 어떤 해상도의 화면에 F11로 띄워도 잘리지 않는다.
 */
function useDemoScales() {
  const [scales, setScales] = useState({ ipad: 0.55, phone: 1 })

  useEffect(() => {
    function update() {
      const availableWidth = window.innerWidth - LAYOUT_PADDING * 2 - LAYOUT_GAP
      const availableHeight = window.innerHeight - LAYOUT_PADDING * 2 - CAPTION_RESERVED

      const widthPerHeightUnit = IPAD_OUTER.width / IPAD_OUTER.height + IPHONE_OUTER.width / IPHONE_OUTER.height
      const heightFromWidth = availableWidth / widthPerHeightUnit
      const outerHeight = Math.max(1, Math.min(availableHeight, heightFromWidth))

      setScales({ ipad: outerHeight / IPAD_OUTER.height, phone: outerHeight / IPHONE_OUTER.height })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return scales
}

/**
 * 시연 전용 화면 — 관리자(iPad)·스태프(iPhone)를 한 화면에 나란히 띄운다.
 * 실제 /admin, /staff 라우트를 iframe으로 그대로 임베딩한다(정적 목업이 아님).
 *
 * 두 iframe은 같은 origin이라 localStorage를 공유하지만, lib/session.ts가 role별로
 * 키를 분리해 저장하므로(team08.session.admin / .staff) 관리자·스태프가 각자 다른
 * Bearer 토큰으로 동시에 로그인된 상태를 유지할 수 있다. 백엔드 세션 자체가 쿠키가 아니라
 * 클라이언트가 명시적으로 붙이는 Bearer 토큰이라(docs/api/hackathon.md:38-39) 여기서
 * 막힐 이유가 없다 — 실제 API 호출도 두 iframe에서 각자 독립적으로 전부 탄다.
 *
 * 2026-09-12: 라우트를 `/`(이 화면)·`/admin`·`/staff` 3개로 고정하면서 이 페이지가 곧
 * 사이트 루트가 됐다. L1 랜딩(routes/LandingPage.tsx)은 더 이상 라우팅하지 않는다.
 * DevNavPanel도 랜딩 대신 여기로 옮겨서, 스케일 없는 원본 화면이 필요할 때 바로 연다.
 */
export function DemoPage() {
  const scales = useDemoScales()

  return (
    <main className="flex h-screen items-center justify-center gap-10 overflow-hidden bg-canvas p-10">
      <figure className="flex flex-col items-center gap-3">
        <figcaption className="text-t-label font-bold text-ink-600">관리자 · iPad</figcaption>
        <IPadFrame scale={scales.ipad}>
          <iframe src="/admin" title="관리자 (iPad)" className="h-full w-full border-0" />
        </IPadFrame>
      </figure>

      <figure className="flex flex-col items-center gap-3">
        <figcaption className="text-t-label font-bold text-ink-600">스태프 · iPhone</figcaption>
        <IPhoneFrame scale={scales.phone}>
          <iframe src="/staff" title="스태프 (iPhone)" className="h-full w-full border-0" />
        </IPhoneFrame>
      </figure>

      <DevNavPanel />
    </main>
  )
}
