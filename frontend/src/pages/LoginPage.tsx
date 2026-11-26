import { Eye, EyeOff, LockKeyhole, LogIn, User } from 'lucide-react'
import { FormEvent, useState } from 'react'

import Logo from '../components/Logo'
import { useAuth } from '../context/AuthContext'
import { login } from '../services/api'

// ---------------------------------------------------------------------------
// Sign-in page. Shown on whatever URL was requested while signed out, so after signing in the
// user stays there (see App.tsx).
// ---------------------------------------------------------------------------

export default function LoginPage() {
  const { login: onLogin } = useAuth()
  const [username, setUsername]   = useState('')
  const [password, setPassword]   = useState('')
  const [showPassword, setShowPw] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [busy, setBusy]           = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
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
    <main id="main" className="flex min-h-screen flex-col items-center justify-center gap-7 px-4 py-10">
      <div className="text-center">
        <h1><Logo size="lg" /></h1>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Remote helpdesk for your clients&apos; PCs</p>
      </div>

      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6 shadow-xl shadow-slate-900/5 dark:shadow-black/30">
        <h2 className="text-lg font-semibold">Sign in</h2>

        <label className="block">
          <span className="mb-1 block text-[13px] text-slate-500 dark:text-slate-400">Username</span>
          <span className="relative block">
            <User size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" required autoFocus autoComplete="username"
                   value={username} onChange={(e) => setUsername(e.target.value)} />
          </span>
        </label>

        <label className="block">
          <span className="mb-1 block text-[13px] text-slate-500 dark:text-slate-400">Password</span>
          <span className="relative block">
            <LockKeyhole size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input px-9" type={showPassword ? 'text' : 'password'} required autoComplete="current-password"
                   value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" onClick={() => setShowPw((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </label>

        {error && <div role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger dark:text-danger-dark">{error}</div>}

        <button type="submit" className="btn-primary w-full gap-2 py-2" disabled={busy}>
          <LogIn size={16} aria-hidden="true" />{busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="text-[12px] text-slate-500 dark:text-slate-400">No account? Ask an administrator to create one.</p>
    </main>
  )
}
