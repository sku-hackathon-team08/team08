import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useFitScale } from '../../lib/useFitScale'
import { VIEWPORT } from '../../lib/uiConstants'
import { AdminLoginPage } from './AdminLoginPage'

/**
 * 관리자 화면은 태블릿 실기기 px(1180×820)를 그대로 쓰는 절대값 레이아웃이다. 브라우저
 * 창 크기가 이 비율과 다르면 background-size:cover 크롭도 원본과 달라지고(직접 비교
 * 확인함), 박스 자체를 CSS로 줄이면 내부 요소가 넘쳐서 레이아웃이 무너진다(더 좁은
 * 창에서 확인함). 그래서 항상 네이티브 1180×820으로 렌더링하고 transform: scale()로만
 * 시각 축소한다 — 창 크기와 무관하게 내부 크롭·레이아웃이 항상 원본과 동일하다.
 *
 * 2026-09-12: `/login`을 없애고 라우트를 `/`·`/admin`·`/staff` 3개로 고정하면서, 로그인
 * 여부 분기를 여기서 한다 — 항상 AdminLoginPage(00→00-1→01)부터 마운트하고, 세션이
 * 있으면 AdminLoginPage 자신의 로딩 단계가 그걸 확인해서 onAuthenticated를 불러 스케일
 * 박스+Outlet(대시보드)으로 넘어간다. 여기서 세션 유무를 먼저 판단해 스플래시를 건너뛰지
 * 않는다 — 새로고침해도 매번 00 스플래시부터 다시 보여야 한다(사용자 확정, 2026-09-12).
 * 로그인 화면은 이 dc.html 스펙에서도 태블릿 네이티브 박스가 아니라 반응형 전체화면이라
 * 스케일 박스 밖에 둔다.
 */
export function AdminLayout() {
  const scale = useFitScale(VIEWPORT.tablet.w, VIEWPORT.tablet.h)
  const [authenticated, setAuthenticated] = useState(false)

  if (!authenticated) {
    return <AdminLoginPage onAuthenticated={() => setAuthenticated(true)} />
  }

  return (
    <div className="flex h-screen items-center justify-center overflow-hidden bg-white">
      <div
        style={{
          width: VIEWPORT.tablet.w,
          height: VIEWPORT.tablet.h,
          transform: `scale(${scale})`,
        }}
      >
        <Outlet />
      </div>
    </div>
  )
}
