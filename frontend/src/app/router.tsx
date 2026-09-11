import { createBrowserRouter } from 'react-router-dom'
import { LandingPage } from '../routes/LandingPage'
import { NotFoundPage } from '../routes/NotFoundPage'
import { AdminLayout } from '../routes/admin/AdminLayout'
import { AdminHomePage } from '../routes/admin/AdminHomePage'
import { StaffLayout } from '../routes/staff/StaffLayout'
import { StaffHomePage } from '../routes/staff/StaffHomePage'

export const router = createBrowserRouter([
  { path: '/map-preview', element: <iframe title="브이월드 3D 행사장" src="/vworld.html" style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', border: 0 }} /> },
  { path: '/', element: <LandingPage /> },
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
