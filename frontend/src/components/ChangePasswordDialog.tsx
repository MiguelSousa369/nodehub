import { FormEvent, useEffect, useState } from 'react'

import { useAuth, useUser } from '../context/AuthContext'
import { changePassword } from '../services/api'
import Dialog from './Dialog'

interface ChangePasswordDialogProps {
  open   : boolean
  onClose: () => void
}

export default function ChangePasswordDialog({ open, onClose }: ChangePasswordDialogProps) {
  const [current, setCurrent] = useState('')
  const [next, setNext]       = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const user = useUser()
  const { login } = useAuth()

  useEffect(() => {
    if (!open) return
    setCurrent(''); setNext(''); setConfirm(''); setMessage(null)
  }, [open])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (next !== confirm) return setMessage({ text: 'The new passwords do not match.', ok: false })
    try {
      const { token } = await changePassword(current, next)
      login(token, user)   // this session continues with the new token; the others are signed out
      setMessage({ text: 'Password changed. Your other sessions were signed out.', ok: true })
      setCurrent(''); setNext(''); setConfirm('')
    } catch (err) {
      setMessage({ text: (err as Error).message, ok: false })
    }
  }

  return (
    <Dialog open={open} title="Change password" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {([['Current password', current, setCurrent, 'current-password'],
           ['New password (at least 10 characters)', next, setNext, 'new-password'],
           ['Confirm new password', confirm, setConfirm, 'new-password']] as const).map(([label, value, set, ac]) => (
          <label key={label} className="block">
            <span className="mb-1 block text-[13px] text-slate-500 dark:text-slate-400">{label}</span>
            <input className="input" type="password" required autoComplete={ac}
                   minLength={label.startsWith('Current') ? 1 : 10}
                   value={value} onChange={(e) => set(e.target.value)} />
          </label>
        ))}
        <div className={`min-h-5 text-sm ${message?.ok ? 'text-online dark:text-online-dark' : 'text-danger dark:text-danger-dark'}`}>
          {message?.text}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>Close</button>
          <button type="submit" className="btn-primary">Change</button>
        </div>
      </form>
    </Dialog>
  )
}
