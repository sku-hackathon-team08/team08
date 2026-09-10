import { Outlet } from 'react-router-dom'

export function StaffLayout() {
  return (
    <div className="min-h-screen p-6">
      <Outlet />
    </div>
  )
}
