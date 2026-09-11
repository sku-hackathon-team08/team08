import { Link } from 'react-router-dom'

/**
 * 개발용 바로가기 패널 — 실제 디자인엔 없는 스캐폴딩(DevStatePanel과 같은 취지).
 * 2026-09-12: 라우트가 `/`(데모)·`/admin`·`/staff` 3개로 고정되면서 L1 랜딩이 라우팅에서
 * 빠졌다. 이 패널은 이제 DemoPage(`/`)에 떠서 개별 화면(스케일 없는 원본 크기)을 바로
 * 확인하고 싶을 때 쓴다. /demo 링크는 뺐다 — 지금 보고 있는 화면 자체가 /demo라서 자기
 * 자신으로 가는 링크는 의미가 없다.
 */
export function DevNavPanel() {
  return (
    <div className="fixed bottom-3 right-3 z-50 flex items-center gap-1 rounded-lg border border-dashed border-status-caution bg-ink-900/90 px-2 py-1.5 font-sans shadow-modal">
      <span className="mr-1 text-[10px] font-bold uppercase tracking-wide text-status-caution">dev · 바로가기</span>
      <Link to="/admin" className="rounded px-2 py-0.5 text-[11px] text-white/80 hover:text-white">
        /admin
      </Link>
      <Link to="/staff" className="rounded px-2 py-0.5 text-[11px] text-white/80 hover:text-white">
        /staff
      </Link>
    </div>
  )
}
