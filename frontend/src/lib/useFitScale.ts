import { useEffect, useState } from 'react'

/**
 * 뷰포트에 맞춰 (nativeWidth × nativeHeight) 고정 박스를 얼마나 축소해야 하는지 계산한다.
 * 관리자 화면은 실기기 px(1180×820)를 그대로 쓰는 절대값 레이아웃이라, 박스 자체를
 * CSS로 더 작게 줄이면(aspect-ratio + width만 제한 등) 내부 요소가 원본 px 그대로 남아
 * 넘치고 줄바꿈이 깨진다(직접 확인함 — 620×1000처럼 좁은 창에서 헤더·필터바가 겹치고
 * 줄바꿈되며 무너짐). 그래서 박스는 항상 네이티브 크기로 렌더링하고, `transform: scale()`로
 * 시각적으로만 축소한다 — /demo의 DeviceFrame과 같은 방식.
 */
export function useFitScale(nativeWidth: number, nativeHeight: number) {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    function update() {
      setScale(Math.min(window.innerWidth / nativeWidth, window.innerHeight / nativeHeight))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [nativeWidth, nativeHeight])

  return scale
}
