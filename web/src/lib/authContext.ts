import { createContext, useContext } from 'react'

export const AuthContext = createContext<{ logout: () => void }>({ logout: () => {} })
export const useAuth = () => useContext(AuthContext)
