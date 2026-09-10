import { Link } from 'react-router-dom'

export function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">현장의 지금</h1>
        <p className="text-sm">진입할 화면을 선택하세요. (임시 라우팅 골격)</p>
      </div>
      <nav className="flex flex-col gap-3">
        <Link to="/admin" className="rounded border p-3 font-medium underline">
          관리자로 이동
        </Link>
        <Link to="/staff" className="rounded border p-3 font-medium underline">
          스태프로 이동
        </Link>
      </nav>
    </main>
  )
}
