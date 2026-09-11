import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useFitScale } from '../../lib/useFitScale'
import { VIEWPORT } from '../../lib/uiConstants'
import { StaffLoginPage } from './StaffLoginPage'

/**
 * AdminLayout과 동일한 구조 — 스태프 화면은 모바일 실기기 px(390×780)를 그대로 쓰는
 * 절대값 레이아웃이라 항상 네이티브 크기로 렌더링하고 transform: scale()로만 시각
 * 축소한다. 항상 StaffLoginPage(S-0→S-0-1→S0)부터 마운트하고, 세션이 있으면
 * StaffLoginPage 자신의 로딩 단계가 확인해서 onAuthenticated로 넘어간다 — 여기서 세션
 * 유무를 먼저 판단해 스플래시를 건너뛰지 않는다(새로고침해도 매번 S-0부터, 2026-09-12).
 */
export function StaffLayout() {
  const scale = useFitScale(VIEWPORT.mobile.w, VIEWPORT.mobile.h)
  const [authenticated, setAuthenticated] = useState(false)

  if (!authenticated) {
    return <StaffLoginPage onAuthenticated={() => setAuthenticated(true)} />
  }

  return (
    <div className="flex h-screen items-center justify-center overflow-hidden bg-white">
      <div
        style={{
          width: VIEWPORT.mobile.w,
          height: VIEWPORT.mobile.h,
          transform: `scale(${scale})`,
        }}
      >
        <Outlet />
      </div>
    </div>
  )
}
