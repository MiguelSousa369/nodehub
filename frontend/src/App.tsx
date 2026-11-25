import { useCallback, useEffect, useState } from 'react'

import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import UsersPage from './pages/UsersPage'
import { getMe } from './services/api'
import type { AuthUser, Page } from './types'

function storedUser(): AuthUser | null {
  try {
    return localStorage.getItem('token') ? JSON.parse(localStorage.getItem('user') ?? 'null') : null
  } catch {
    return null
  }
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(storedUser)
  const [page, setPage] = useState<Page>(() => (storedUser() ? 'dashboard' : 'login'))

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    setPage('login')
  }, [])

  // Refresh the stored user (role or name may have changed); sign out if the session is no longer valid
  useEffect(() => {
    if (!localStorage.getItem('token')) return
    getMe()
      .then((u) => { setUser(u); localStorage.setItem('user', JSON.stringify(u)) })
      .catch(logout)
  }, [logout])

  function login(token: string, u: AuthUser) {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(u))
    setUser(u)
    setPage('dashboard')
  }

  if (page === 'login' || !user) return <LoginPage onLogin={login} />
  if (page === 'users' && user.role === 'ADMIN') return <UsersPage user={user} onNav={setPage} onLogout={logout} />
  return <DashboardPage user={user} onNav={setPage} onLogout={logout} />
}
