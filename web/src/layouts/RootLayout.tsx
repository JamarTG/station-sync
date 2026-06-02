import { useEffect, useState } from 'react'
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { Sidebar } from '../components/Sidebar'
import { TopBar } from '../components/TopBar'
import { ShiftLoginFlow } from '../pages/ShiftLoginFlow'
import { ChangePasswordPage } from '../pages/ChangePasswordPage'
import { useAuth } from '../lib/authContext'
import { useDarkMode } from '../hooks/useDarkMode'

const ROUTE_TITLES: Record<string, string> = {
  '/':                      'Dashboard',
  '/sales':                 'Sales',
  '/accounts':              'Accounts',
  '/reports':               'Reports',
  '/staff':                 'Staff',
  '/schedule':              'Schedule',
  '/charges':               'Charges',
  '/expenses':              'Expenses',
  '/settings':              'Settings',
  '/convenience/sales':     'Sales',
  '/convenience/accounts':  'Accounts',
  '/convenience/reports':   'Reports',
  '/convenience/staff':     'Staff',
  '/convenience/schedule':  'Schedule',
  '/convenience/products':  'Products',
  '/rankings':              'Rankings',
  '/employee-rankings':     'Rankings',
  '/fuel-intelligence':     'Fuel Intelligence',
  '/payroll':               'Payroll',
  '/holidays':              'Holidays & Premium Pay',
}

export function RootLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [shiftFlowDone, setShiftFlowDone] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { dark, toggle: toggleDark } = useDarkMode()

  useEffect(() => {
    const label = ROUTE_TITLES[pathname]
    document.title = label ? `${label} — StationSync` : 'StationSync'
  }, [pathname])

  useEffect(() => {
    if (!user) navigate({ to: '/login' })
  }, [user])

  if (!user) return null

  if (user.must_change_password) {
    return <ChangePasswordPage />
  }

  const skipShiftFlow = ['Super Admin', 'Admin', 'Manager', 'Cashier', 'Attendant'].includes(user.role)

  if (!shiftFlowDone && !skipShiftFlow) {
    return <ShiftLoginFlow user={user} onComplete={() => setShiftFlowDone(true)} />
  }

  return (
    <div className="flex h-screen bg-white dark:bg-[#0f0f0f] font-[Manrope]">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 min-[668px]:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <TopBar onMenuClick={() => setSidebarOpen(true)} onLogout={logout} dark={dark} onToggleDark={toggleDark} />
        <main className="flex-1 overflow-y-scroll">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
