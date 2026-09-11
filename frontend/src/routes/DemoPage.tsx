import { IPadFrame, IPhoneFrame } from '../components/DeviceFrame'

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
 * 라우트는 /admin·/staff와 별개로 둔다. 실제 사용자가 들어오는 화면(L1 랜딩 등)은
 * 이 페이지의 영향을 받지 않는다.
 */
export function DemoPage() {
  return (
    <main className="flex min-h-screen flex-wrap items-start justify-center gap-10 bg-canvas p-10">
      <figure className="flex flex-col items-center gap-3">
        <figcaption className="text-t-label font-bold text-ink-600">관리자 · iPad</figcaption>
        <IPadFrame scale={0.55}>
          <iframe src="/admin" title="관리자 (iPad)" className="h-full w-full border-0" />
        </IPadFrame>
      </figure>

      <figure className="flex flex-col items-center gap-3">
        <figcaption className="text-t-label font-bold text-ink-600">스태프 · iPhone</figcaption>
        <IPhoneFrame scale={1}>
          <iframe src="/staff" title="스태프 (iPhone)" className="h-full w-full border-0" />
        </IPhoneFrame>
      </figure>
    </main>
  )
}
