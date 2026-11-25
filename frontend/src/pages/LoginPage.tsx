import { FormEvent, useState } from 'react'

import { getInstallerStatus } from '../services/api'

interface LoginPageProps {
  onLogin: (token: string) => void
}

/** Asks once for the API key (API_KEY in backend/.env) and checks it against the backend. */
export default function LoginPage({ onLogin }: LoginPageProps) {
  const [key, setKey]     = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    localStorage.setItem('token', key.trim())
    try {
      await getInstallerStatus()
      onLogin(key.trim())
    } catch (err) {
      localStorage.removeItem('token')
      setError((err as Error).message)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <h1 className="text-xl font-semibold">node<span className="text-brand dark:text-brand-dark">hub</span></h1>
        <label className="block">
          <span className="mb-1 block text-[13px] text-slate-500 dark:text-slate-400">
            API key (<code>API_KEY</code> in <code>backend/.env</code>)
          </span>
          <input className="input" type="password" required autoFocus value={key} onChange={(e) => setKey(e.target.value)} />
        </label>
        {error && <div className="text-sm text-danger dark:text-danger-dark">{error}</div>}
        <button type="submit" className="btn-primary w-full">Sign in</button>
      </form>
    </div>
  )
}
