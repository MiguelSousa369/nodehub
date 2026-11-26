import { Navigate, Route, Routes } from 'react-router'

import Backdrop from './components/Backdrop'
import { useAuth } from './context/AuthContext'
import ConnectPage from './pages/ConnectPage'
import DashboardPage from './pages/DashboardPage'
import HistoryPage from './pages/HistoryPage'
import LoginPage from './pages/LoginPage'
import UsersPage from './pages/UsersPage'

// ---------------------------------------------------------------------------
// Routes
//
//   /                    machines, grouped by client
//   /history             helpdesk sessions (filters in the query string)
//   /users               user management (admins)
//   /connect?code=…      approve a PC opened by "nodehub login"
//
// The backend serves index.html for any non-API path, so every URL can be opened directly.
// While signed out, the login page is shown on whatever URL was requested, so after signing in
// the user lands where they meant to go (e.g. the /connect link from "nodehub login").
// ---------------------------------------------------------------------------

export default function App() {
  const { user } = useAuth()

  return (
    <>
      <Backdrop />
      {user ? <SignedInRoutes isAdmin={user.role === 'ADMIN'} /> : <LoginPage />}
    </>
  )
}

function SignedInRoutes({ isAdmin }: { isAdmin: boolean }) {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/users" element={isAdmin ? <UsersPage /> : <Navigate to="/" replace />} />
      <Route path="/connect" element={<ConnectPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
