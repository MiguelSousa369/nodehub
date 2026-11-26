import { History, KeyRound, LogOut, Monitor, MonitorSmartphone, Users } from 'lucide-react'
import { ReactNode, useState } from 'react'
import { Link, NavLink } from 'react-router'

import { useAuth, useUser } from '../context/AuthContext'
import ChangePasswordDialog from './ChangePasswordDialog'
import ConnectedPcsDialog from './ConnectedPcsDialog'
import Logo from './Logo'
import Menu from './Menu'

interface HeaderProps {
  children?: ReactNode   // page-specific controls (summary, filter, actions)
}

/** "Miguel Sousa" → "MS"; a single name gives its first two letters. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)
  return letters.toUpperCase()
}

// ---------------------------------------------------------------------------
// Top bar: logo, tabs, the page's own controls, and the user menu.
// On small screens the page controls wrap to a second, full-width row.
// ---------------------------------------------------------------------------

export default function Header({ children }: HeaderProps) {
  const user = useUser()
  const { logout } = useAuth()
  const [dialog, setDialog] = useState<'password' | 'pcs' | null>(null)

  // Tabs are links, so the browser's back button, new tabs and bookmarks work
  const tab = (to: string, label: string, icon: ReactNode) => (
    <NavLink
      to={to}
      end
      className={({ isActive }) => `flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition ${isActive
        ? 'bg-surface font-semibold text-slate-900 dark:bg-surface-dark dark:text-white'
        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
      <span className="sr-only sm:hidden">{label}</span>
    </NavLink>
  )

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-surface-card/80 backdrop-blur-md
                       dark:border-slate-700/60 dark:bg-surface-card-dark/75">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3 sm:px-6">
        <Link to="/" className="mr-1 rounded-md" aria-label="nodehub, go to machines"><Logo /></Link>

        <nav className="flex gap-0.5" aria-label="Main">
          {tab('/', 'Machines', <Monitor size={16} />)}
          {tab('/history', 'History', <History size={16} />)}
          {user.role === 'ADMIN' && tab('/users', 'Users', <Users size={16} />)}
        </nav>

        {/* Page controls: inline on wide screens, own row below on phones */}
        <div className="order-last flex w-full flex-wrap items-center gap-3 md:order-none md:w-auto md:flex-1">
          {children}
        </div>

        <div className="ml-auto md:ml-0">
          <Menu
            label={`Account menu for ${user.name}`}
            triggerClass="flex h-9 w-9 items-center justify-center rounded-full bg-brand/15 text-[13px] font-semibold
                          text-brand transition hover:bg-brand/25 dark:bg-brand-dark/20 dark:text-brand-dark"
            trigger={initials(user.name)}
            header={
              <>
                <div className="text-sm font-semibold">{user.name}</div>
                <div className="text-[13px] text-slate-500 dark:text-slate-400">
                  {user.username} · {user.role === 'ADMIN' ? 'Admin' : 'Technician'}
                </div>
              </>
            }
            items={[
              { label: 'Connected PCs', icon: <MonitorSmartphone size={16} />, onClick: () => setDialog('pcs') },
              { label: 'Change password', icon: <KeyRound size={16} />, onClick: () => setDialog('password') },
              'separator',
              { label: 'Sign out', icon: <LogOut size={16} />, onClick: logout, danger: true },
            ]}
          />
        </div>
      </div>

      <ChangePasswordDialog open={dialog === 'password'} onClose={() => setDialog(null)} />
      <ConnectedPcsDialog open={dialog === 'pcs'} onClose={() => setDialog(null)} />
    </header>
  )
}
