import { Link } from 'react-router-dom'

/**
 * 개발용 바로가기 패널 — 실제 디자인엔 없는 스캐폴딩(DevStatePanel과 같은 취지).
 * L1의 "로그인"/"행사 신청" 버튼은 아직 없는 화면(/login, /events/new)으로 연결돼 있어서
 * 실제 로그인 화면이 생기기 전까지는 랜딩에서 더 못 들어간다. 그동안 개발 중 화면
 * 확인용으로 /admin·/staff·/demo 바로가기를 띄워둔다. 로그인 화면(01/S0) 만들면 뗀다.
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
      <Link to="/demo" className="rounded px-2 py-0.5 text-[11px] text-white/80 hover:text-white">
        /demo
      </Link>
    </div>
  )
}
