import { FormEvent, useEffect, useState } from 'react'

import { useI18n } from '../i18n'
import { createUser, updateUser } from '../services/api'
import type { Role, User } from '../types'
import Dialog from './Dialog'

interface UserFormDialogProps {
  open   : boolean
  user   : User | null          // null = create a new user
  onClose: () => void
  onSaved: (message: string) => void
}

export default function UserFormDialog({ open, user, onClose, onSaved }: UserFormDialogProps) {
  const { t } = useI18n()
  const [username, setUsername] = useState('')
  const [name, setName]         = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole]         = useState<Role>('TECHNICIAN')
  const [active, setActive]     = useState(true)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setUsername(user?.username ?? '')
    setName(user?.name ?? '')
    setPassword('')
    setRole(user?.role ?? 'TECHNICIAN')
    setActive(user?.active ?? true)
    setError(null)
  }, [open, user])

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      if (user) {
        await updateUser(user.id, { name: name.trim(), role, active, ...(password ? { password } : {}) })
        onSaved(t.userForm.updated(user.username))
      } else {
        const created = await createUser({ username: username.trim(), name: name.trim(), password, role })
        onSaved(t.userForm.created(created.username))
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const label = 'mb-1 block text-[13px] text-slate-500 dark:text-slate-400'

  return (
    <Dialog open={open} title={user ? t.userForm.editTitle(user.username) : t.userForm.addTitle} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className={label}>{t.userForm.username}</span>
          <input className="input" required disabled={Boolean(user)} pattern="[A-Za-z0-9._\-]{3,32}"
                 autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="block">
          <span className={label}>{t.userForm.name}</span>
          <input className="input" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className={label}>{user ? t.userForm.passwordKeep : t.userForm.passwordNew}</span>
          <input className="input" type="password" required={!user} minLength={10} autoComplete="new-password"
                 value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="block">
          <span className={label}>{t.userForm.role}</span>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="TECHNICIAN">{t.userForm.roleTechnician}</option>
            <option value="ADMIN">{t.userForm.roleAdmin}</option>
          </select>
        </label>
        {user && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            {t.userForm.active}
          </label>
        )}
        <div role="alert" className="min-h-5 text-sm text-danger dark:text-danger-dark">{error}</div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>{t.common.cancel}</button>
          <button type="submit" className="btn-primary">{t.common.save}</button>
        </div>
      </form>
    </Dialog>
  )
}
