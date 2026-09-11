import { Outlet } from 'react-router-dom'
import { useFitScale } from '../../lib/useFitScale'
import { VIEWPORT } from '../../lib/uiConstants'

/**
 * 관리자 화면은 태블릿 실기기 px(1180×820)를 그대로 쓰는 절대값 레이아웃이다. 브라우저
 * 창 크기가 이 비율과 다르면 background-size:cover 크롭도 원본과 달라지고(직접 비교
 * 확인함), 박스 자체를 CSS로 줄이면 내부 요소가 넘쳐서 레이아웃이 무너진다(더 좁은
 * 창에서 확인함). 그래서 항상 네이티브 1180×820으로 렌더링하고 transform: scale()로만
 * 시각 축소한다 — 창 크기와 무관하게 내부 크롭·레이아웃이 항상 원본과 동일하다.
 */
export function AdminLayout() {
  const scale = useFitScale(VIEWPORT.tablet.w, VIEWPORT.tablet.h)

  return (
    <div className="flex h-screen items-center justify-center overflow-hidden bg-canvas">
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
