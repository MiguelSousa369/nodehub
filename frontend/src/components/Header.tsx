import { ReactNode, useState } from 'react'
import { NavLink } from 'react-router'

import { useAuth, useUser } from '../context/AuthContext'
import ChangePasswordDialog from './ChangePasswordDialog'
import ConnectedPcsDialog from './ConnectedPcsDialog'

interface HeaderProps {
  children?: ReactNode   // page-specific controls (summary, filter, actions)
}

export default function Header({ children }: HeaderProps) {
  const user = useUser()
  const { logout } = useAuth()
  const [dialog, setDialog] = useState<'password' | 'pcs' | null>(null)

  // Tabs are links, so the browser's back button, new tabs and bookmarks work
  const tab = (to: string, label: string) => (
    <NavLink
      to={to}
      end
      className={({ isActive }) => `rounded-md px-2.5 py-1 text-sm ${isActive
        ? 'bg-surface font-semibold dark:bg-surface-dark'
        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
    >{label}</NavLink>
  )

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-surface-card px-4 py-3.5 sm:px-6
                       dark:border-slate-700/60 dark:bg-surface-card-dark">
      <h1 className="mr-2 text-xl font-semibold">node<span className="text-brand dark:text-brand-dark">hub</span></h1>
      <nav className="flex gap-1">
        {tab('/', 'Machines')}
        {tab('/history', 'History')}
        {user.role === 'ADMIN' && tab('/users', 'Users')}
      </nav>
      {children}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500 dark:text-slate-400" title={user.username}>{user.name}</span>
        <button className="btn" onClick={() => setDialog('pcs')}>Connected PCs</button>
        <button className="btn" onClick={() => setDialog('password')}>Password</button>
        <button className="btn" onClick={logout}>Sign out</button>
      </div>
      <ChangePasswordDialog open={dialog === 'password'} onClose={() => setDialog(null)} />
      <ConnectedPcsDialog open={dialog === 'pcs'} onClose={() => setDialog(null)} />
    </header>
  )
}
