import { createContext, useContext } from 'react'
import type { AuthUser } from './api'

interface AuthContextValue {
  user: AuthUser | null
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue>({ user: null, logout: () => {} })
export const useAuth = () => useContext(AuthContext)
