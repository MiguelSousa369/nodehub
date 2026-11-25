import { ReactNode, useState } from 'react'

import type { AuthUser, Page } from '../types'
import ChangePasswordDialog from './ChangePasswordDialog'
import ConnectedPcsDialog from './ConnectedPcsDialog'

interface HeaderProps {
  user     : AuthUser
  page     : Page
  onNav    : (page: Page) => void
  onLogout : () => void
  children?: ReactNode   // page-specific controls (summary, filter, actions)
}

export default function Header({ user, page, onNav, onLogout, children }: HeaderProps) {
  const [dialog, setDialog] = useState<'password' | 'pcs' | null>(null)

  const tab = (target: Page, label: string) => (
    <button
      onClick={() => onNav(target)}
      className={`rounded-md px-2.5 py-1 text-sm ${page === target
        ? 'bg-surface font-semibold dark:bg-surface-dark'
        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
    >{label}</button>
  )

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-surface-card px-4 py-3.5 sm:px-6
                       dark:border-slate-700/60 dark:bg-surface-card-dark">
      <h1 className="mr-2 text-xl font-semibold">node<span className="text-brand dark:text-brand-dark">hub</span></h1>
      <nav className="flex gap-1">
        {tab('dashboard', 'Machines')}
        {tab('history', 'History')}
        {user.role === 'ADMIN' && tab('users', 'Users')}
      </nav>
      {children}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500 dark:text-slate-400" title={user.username}>{user.name}</span>
        <button className="btn" onClick={() => setDialog('pcs')}>Connected PCs</button>
        <button className="btn" onClick={() => setDialog('password')}>Password</button>
        <button className="btn" onClick={onLogout}>Sign out</button>
      </div>
      <ChangePasswordDialog open={dialog === 'password'} onClose={() => setDialog(null)} />
      <ConnectedPcsDialog open={dialog === 'pcs'} onClose={() => setDialog(null)} />
    </header>
  )
}
