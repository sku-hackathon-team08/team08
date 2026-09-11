import { createBrowserRouter } from 'react-router-dom'
import { DemoPage } from '../routes/DemoPage'
import { LandingPage } from '../routes/LandingPage'
import { NotFoundPage } from '../routes/NotFoundPage'
import { AdminLayout } from '../routes/admin/AdminLayout'
import { AdminHomePage } from '../routes/admin/AdminHomePage'
import { AdminLoginPage } from '../routes/admin/AdminLoginPage'
import { StaffLayout } from '../routes/staff/StaffLayout'
import { StaffHomePage } from '../routes/staff/StaffHomePage'

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/demo', element: <DemoPage /> },
  { path: '/login', element: <AdminLoginPage /> },
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
