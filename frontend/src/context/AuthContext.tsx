import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { getMe } from '../services/api'
import type { AuthUser } from '../types'

// ---------------------------------------------------------------------------
// Signed-in user, shared by every page (token and user are kept in localStorage)
// ---------------------------------------------------------------------------

interface AuthState {
  user  : AuthUser | null
  login : (token: string, user: AuthUser) => void
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

function storedUser(): AuthUser | null {
  try {
    return localStorage.getItem('token') ? JSON.parse(localStorage.getItem('user') ?? 'null') : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(storedUser)

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  const login = useCallback((token: string, u: AuthUser) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(u))
    setUser(u)
  }, [])

  // Refresh the stored user (role or name may have changed); sign out if the session is no longer valid
  useEffect(() => {
    if (!localStorage.getItem('token')) return
    getMe()
      .then((u) => { setUser(u); localStorage.setItem('user', JSON.stringify(u)) })
      .catch(logout)
  }, [logout])

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** The auth state; only call it below <AuthProvider>. */
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** For pages behind sign-in: the user is guaranteed to exist there (App renders the login page otherwise). */
export function useUser(): AuthUser {
  const { user } = useAuth()
  if (!user) throw new Error('useUser called while signed out')
  return user
}
