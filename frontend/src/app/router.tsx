import { createBrowserRouter } from 'react-router-dom'
import { DemoPage } from '../routes/DemoPage'
import { NotFoundPage } from '../routes/NotFoundPage'
import { AdminLayout } from '../routes/admin/AdminLayout'
import { AdminHomePage } from '../routes/admin/AdminHomePage'
import { StaffLayout } from '../routes/staff/StaffLayout'
import { StaffHomePage } from '../routes/staff/StaffHomePage'

/**
 * 라우트는 3개로 고정: `/`(시연용 admin+staff 동시 뷰) · `/admin` · `/staff`.
 * L1 랜딩(routes/LandingPage.tsx)·/login은 더 이상 라우팅하지 않는다(2026-09-12 결정) —
 * 로그인(00→01)은 AdminLayout이 세션 유무로 직접 분기해서 보여준다. LandingPage.tsx
 * 파일 자체는 지우지 않고 남겨뒀다(추후 실제 서비스 진입점이 다시 필요해지면 참고).
 */
export const router = createBrowserRouter([
  { path: '/', element: <DemoPage /> },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [{ index: true, element: <AdminHomePage /> }],
  },
  {
    path: '/staff',
    element: <StaffLayout />,
    children: [{ index: true, element: <StaffHomePage /> }],
  },
  { path: '*', element: <NotFoundPage /> },
])
