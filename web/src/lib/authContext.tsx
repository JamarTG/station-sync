import { createContext, useContext, useEffect, useState } from 'react'
import { logout as apiLogout, loadSavedSession, clearToken, saveUser, setUnauthorizedHandler } from './api'
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
  const [user, setUserState] = useState<AuthUser | null>(restoreUser)

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearToken()
      setUserState(null)
    })
  }, [])

  function setUser(u: AuthUser | null) {
    if (u) saveUser(u)
    setUserState(u)
  }

  function logout() {
    clearToken()
    setUserState(null)
    apiLogout().catch(() => {})
  }

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
