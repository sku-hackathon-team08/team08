import { Link } from 'react-router-dom'

export function StaffHomePage() {
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold">스태프 화면 (임시)</h1>
      <p className="text-sm">
        라우팅 골격 확인용 임시 페이지입니다. 실제 참가자 등록·신고 기능은 이후 작업에서 추가됩니다.
      </p>
      <Link to="/" className="underline">
        공통 진입 화면으로
      </Link>
    </section>
  )
}
