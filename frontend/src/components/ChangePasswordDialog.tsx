import { FormEvent, useEffect, useState } from 'react'

import { useAuth, useUser } from '../context/AuthContext'
import { useI18n } from '../i18n'
import { changePassword } from '../services/api'
import Dialog from './Dialog'

interface ChangePasswordDialogProps {
  open   : boolean
  onClose: () => void
}

export default function ChangePasswordDialog({ open, onClose }: ChangePasswordDialogProps) {
  const { t } = useI18n()
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
    if (next !== confirm) return setMessage({ text: t.password.mismatch, ok: false })
    try {
      const { token } = await changePassword(current, next)
      login(token, user)   // this session continues with the new token; the others are signed out
      setMessage({ text: t.password.changed, ok: true })
      setCurrent(''); setNext(''); setConfirm('')
    } catch (err) {
      setMessage({ text: (err as Error).message, ok: false })
    }
  }

  const fields = [
    { label: t.password.current, value: current, set: setCurrent, autoComplete: 'current-password', minLength: 1 },
    { label: t.password.new, value: next, set: setNext, autoComplete: 'new-password', minLength: 10 },
    { label: t.password.confirm, value: confirm, set: setConfirm, autoComplete: 'new-password', minLength: 10 },
  ]

  return (
    <Dialog open={open} title={t.password.title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {fields.map((f) => (
          <label key={f.label} className="block">
            <span className="mb-1 block text-[13px] text-slate-500 dark:text-slate-400">{f.label}</span>
            <input className="input" type="password" required autoComplete={f.autoComplete} minLength={f.minLength}
                   value={f.value} onChange={(e) => f.set(e.target.value)} />
          </label>
        ))}
        <div role="status" className={`min-h-5 text-sm ${message?.ok ? 'text-online dark:text-online-dark' : 'text-danger dark:text-danger-dark'}`}>
          {message?.text}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>{t.common.close}</button>
          <button type="submit" className="btn-primary">{t.password.change}</button>
        </div>
      </form>
    </Dialog>
  )
}
