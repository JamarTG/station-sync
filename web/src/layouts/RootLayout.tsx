import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from '@tanstack/react-router'
import { Sidebar } from '../components/Sidebar'
import { TopBar } from '../components/TopBar'
import { CashierDashboard } from '../components/dashboard/CashierDashboard'
import { ShiftLoginFlow } from '../pages/ShiftLoginFlow'
import { ChangePasswordPage } from '../pages/ChangePasswordPage'
import { useAuth } from '../lib/authContext'

export function RootLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [shiftFlowDone, setShiftFlowDone] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [posMode, setPosMode] = useState(false)

  useEffect(() => {
    if (!user) navigate({ to: '/login' })
  }, [user])

  if (!user) return null

  if (user.must_change_password) {
    return <ChangePasswordPage />
  }

  const skipShiftFlow = ['Super Admin', 'Admin', 'Manager', 'Attendant'].includes(user.role)

  if (!shiftFlowDone && !skipShiftFlow) {
    return <ShiftLoginFlow user={user} onComplete={() => setShiftFlowDone(true)} />
  }

  return (
    <div className="flex h-screen bg-[#f4f4f4] font-[Manrope]">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 min-[668px]:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} posMode={posMode} onTogglePosMode={() => setPosMode((p) => !p)} />

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <TopBar onMenuClick={() => setSidebarOpen(true)} onLogout={logout} />
        <main className="flex-1 overflow-y-scroll">
          {posMode ? <CashierDashboard /> : <Outlet />}
        </main>
      </div>
    </div>
  )
}
