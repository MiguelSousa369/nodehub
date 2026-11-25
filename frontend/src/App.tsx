import { useCallback, useEffect, useState } from 'react'

import ConnectPage from './pages/ConnectPage'
import DashboardPage from './pages/DashboardPage'
import HistoryPage from './pages/HistoryPage'
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

/** "nodehub login" opens /connect?code=XXXX-XXXX; remember the code across the sign-in page. */
function connectCodeFromUrl(): string | null {
  if (window.location.pathname !== '/connect') return null
  return new URLSearchParams(window.location.search).get('code')
}

export default function App() {
  const [user, setUser]               = useState<AuthUser | null>(storedUser)
  const [connectCode, setConnectCode] = useState<string | null>(connectCodeFromUrl)
  const [page, setPage]               = useState<Page>(() => (connectCodeFromUrl() ? 'connect' : 'dashboard'))

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
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
  }

  function leaveConnect() {
    window.history.replaceState(null, '', '/')
    setConnectCode(null)
    setPage('dashboard')
  }

  if (!user) return <LoginPage onLogin={login} />
  if (page === 'connect' && connectCode) {
    return <ConnectPage user={user} code={connectCode} onDone={leaveConnect} onLogout={logout} />
  }
  if (page === 'history') return <HistoryPage user={user} onNav={setPage} onLogout={logout} />
  if (page === 'users' && user.role === 'ADMIN') return <UsersPage user={user} onNav={setPage} onLogout={logout} />
  return <DashboardPage user={user} onNav={setPage} onLogout={logout} />
}
