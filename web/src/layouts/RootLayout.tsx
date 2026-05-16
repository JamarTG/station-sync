import { useState } from 'react'
import { Outlet } from '@tanstack/react-router'
import { Sidebar } from '../components/Sidebar'
import { TopBar } from '../components/TopBar'
import { CashierDashboard } from '../components/dashboard/CashierDashboard'
import { LoginPage } from '../pages/LoginPage'
import { SignUpPage } from '../pages/SignUpPage'
import { ShiftLoginFlow } from '../pages/ShiftLoginFlow'
import { ChangePasswordPage } from '../pages/ChangePasswordPage'
import { AuthContext } from '../lib/authContext'
import { logout, loadSavedSession } from '../lib/api'
import type { AuthUser } from '../lib/api'

function restoreUser(): AuthUser | null {
  const saved = loadSavedSession()
  return saved ? saved.user : null
}

export function RootLayout() {
  const [user, setUser] = useState<AuthUser | null>(restoreUser)
  const [shiftFlowDone, setShiftFlowDone] = useState(false)
  const [authView, setAuthView] = useState<'login' | 'signup'>('login')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [posMode, setPosMode] = useState(false)

  function handleLogout() {
    logout().catch(() => {})
    setUser(null)
    setShiftFlowDone(false)
  }

  if (!user) {
    if (authView === 'signup') {
      return (
        <SignUpPage
          onSignUp={(u) => setUser(u)}
          onGoToLogin={() => setAuthView('login')}
        />
      )
    }
    return (
      <LoginPage
        onLogin={(u) => setUser(u)}
        onGoToSignUp={() => setAuthView('signup')}
      />
    )
  }

  if (user.must_change_password) {
    return (
      <ChangePasswordPage
        onDone={() => setUser({ ...user, must_change_password: false })}
      />
    )
  }

  const skipShiftFlow = ['Super Admin', 'Admin', 'Manager', 'Attendant'].includes(user.role)

  if (!shiftFlowDone && !skipShiftFlow) {
    return <ShiftLoginFlow user={user} onComplete={() => setShiftFlowDone(true)} />
  }

  return (
    <AuthContext.Provider value={{ user, logout: handleLogout }}>
      <div className="flex h-screen bg-[#f4f4f4] font-[Manrope]">
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 min-[668px]:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} posMode={posMode} onTogglePosMode={() => setPosMode((p) => !p)} />

        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <TopBar onMenuClick={() => setSidebarOpen(true)} onLogout={handleLogout} />
          <main className="flex-1 overflow-y-auto min-[1200px]:overflow-hidden">
            {posMode ? <CashierDashboard /> : <Outlet />}
          </main>
        </div>
      </div>
    </AuthContext.Provider>
  )
}
