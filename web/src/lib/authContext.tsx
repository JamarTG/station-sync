import { createContext, useContext, useState } from 'react'
import { logout as apiLogout, loadSavedSession } from './api'
import type { AuthUser } from './api'

interface AuthContextValue {
  user: AuthUser | null
  setUser: (user: AuthUser | null) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  setUser: () => {},
  logout: () => {},
})

export const useAuth = () => useContext(AuthContext)

function restoreUser(): AuthUser | null {
  const saved = loadSavedSession()
  return saved ? saved.user : null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(restoreUser)

  function logout() {
    apiLogout().catch(() => {})
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
