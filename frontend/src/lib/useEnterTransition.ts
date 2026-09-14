import { useEffect, useState } from 'react'

/**
 * 화면·모달이 나타날 때 페이드+슬라이드로 살짝 진입하는 애니메이션용 훅 — 라이브러리 없이
 * CSS transition만 쓴다. 마운트 직후 시작 상태(false)에서 다음 프레임에 종료 상태(true)로
 * 바뀌고, 그 사이를 호출부의 `transition-*` 클래스가 애니메이션한다.
 *
 * `key`를 넘기면 그 값이 바뀔 때마다(예: phase, 선택된 신고 id) entered를 false로 리셋하고
 * 다시 true로 재생한다 — StaffHomePage/AdminHomePage처럼 컴포넌트 자체는 안 없어지고 내부
 * 조건 분기만 바뀌는 화면 전환에 쓴다. 컴포넌트가 매번 새로 마운트되는 경우(모달의 open,
 * 로그인 페이지의 phase별 블록)는 key 없이 써도 마운트 시점에 한 번 재생된다.
 *
 * key 변경에 따른 리셋은 effect 안에서 곧장 setState하지 않고(oxlint
 * react/set-state-in-effect가 지적하는 패턴 — 이 코드베이스는 다른 곳에서도 이 권고를
 * 따른다) 렌더 중에 바로 반영한다(React 공식 문서 "Adjusting state when a prop changes"
 * 패턴). true로 되돌리는 effect만 남아, 그 안의 setState는 rAF 콜백 안에서 비동기로
 * 실행된다.
 *
 * 종료(탈출) 애니메이션은 없다 — 화면이 바뀌면 즉시 사라진다. React Transition Group 같은
 * 라이브러리 없이 진입만 다루는 게 지금 필요한 만큼의 단순한 구현이다.
 */
export function useEnterTransition(key?: unknown): boolean {
  const [entered, setEntered] = useState(false)
  const [prevKey, setPrevKey] = useState(key)

  if (key !== prevKey) {
    setPrevKey(key)
    setEntered(false)
  }

  useEffect(() => {
    if (entered) return
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [entered])

  return entered
}
