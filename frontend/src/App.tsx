import { useCallback, useState } from 'react'

import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import type { Page } from './types'

export default function App() {
  const [page, setPage] = useState<Page>(() => (localStorage.getItem('token') ? 'dashboard' : 'login'))

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setPage('login')
  }, [])

  if (page === 'login') return <LoginPage onLogin={() => setPage('dashboard')} />
  return <DashboardPage onLogout={logout} />
}
