import { FormEvent, useState } from 'react'

import { login } from '../services/api'
import type { AuthUser } from '../types'

interface LoginPageProps {
  onLogin: (token: string, user: AuthUser) => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [busy, setBusy]         = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const { token, user } = await login(username.trim(), password)
      onLogin(token, user)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <h1 className="text-xl font-semibold">node<span className="text-brand dark:text-brand-dark">hub</span></h1>
        <label className="block">
          <span className="mb-1 block text-[13px] text-slate-500 dark:text-slate-400">Username</span>
          <input className="input" required autoFocus autoComplete="username"
                 value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[13px] text-slate-500 dark:text-slate-400">Password</span>
          <input className="input" type="password" required autoComplete="current-password"
                 value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <div className="text-sm text-danger dark:text-danger-dark">{error}</div>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>Sign in</button>
      </form>
    </div>
  )
}
