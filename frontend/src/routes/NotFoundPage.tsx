import { Link } from 'react-router-dom'
import { DevNavPanel } from '../components/DevNavPanel'

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">페이지를 찾을 수 없습니다</h1>
      <p className="text-sm">요청한 경로가 존재하지 않습니다.</p>
      <Link to="/" className="underline">
        공통 진입 화면으로
      </Link>

      <DevNavPanel />
    </main>
  )
}
