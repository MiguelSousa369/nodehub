import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { useAuth, useUser } from '../context/AuthContext'
import { ApiError, decideCliLogin, getCliLogin } from '../services/api'
import type { CliLoginRequest } from '../types'

type State = 'loading' | 'ask' | 'approved' | 'denied' | 'error'

/** Approval page opened by "nodehub login": connects a PC to the signed-in account. */
export default function ConnectPage() {
  const user = useUser()
  const { logout: onLogout } = useAuth()
  const code = useSearchParams()[0].get('code') ?? ''
  const [request, setRequest] = useState<CliLoginRequest | null>(null)
  const [state, setState]     = useState<State>('loading')
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!code) {
      setError('This link has no connection code. Run "nodehub login" again.')
      setState('error')
      return
    }
    getCliLogin(code)
      .then((r) => {
        setRequest(r)
        setState(r.status === 'PENDING' ? 'ask' : 'error')
        if (r.status !== 'PENDING') setError('This request was already answered.')
      })
      .catch((e: Error) => {
        if (e instanceof ApiError && e.code === 'UNAUTHORIZED') return onLogout()
        setError(e.message)
        setState('error')
      })
  }, [code, onLogout])

  async function decide(approve: boolean) {
    try {
      await decideCliLogin(code, approve)
      setState(approve ? 'approved' : 'denied')
    } catch (e) {
      setError((e as Error).message)
      setState('error')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md space-y-4 p-6">
        <h1 className="text-xl font-semibold">node<span className="text-brand dark:text-brand-dark">hub</span></h1>

        {state === 'loading' && <p className="text-sm text-slate-500">Loading…</p>}

        {state === 'ask' && request && (
          <>
            <h2 className="text-lg font-semibold">Connect this PC?</h2>
            <p className="text-sm">
              <b>{request.deviceName}</b> is asking to use nodehub as <b>{user.name}</b> ({user.username}).
              Claude Code on that PC will be able to read machine history and record sessions in your name.
            </p>
            <div className="rounded-lg bg-surface p-3 text-center dark:bg-surface-dark">
              <div className="text-[13px] text-slate-500 dark:text-slate-400">Check that the terminal shows the same code</div>
              <div className="font-mono text-2xl font-semibold tracking-widest">{request.userCode}</div>
            </div>
            <p className="text-[13px] text-slate-500 dark:text-slate-400">
              Only approve if you just ran <code>nodehub login</code> or clicked <b>Open in Claude</b> on that PC.
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn" onClick={() => decide(false)}>Deny</button>
              <button className="btn-primary" onClick={() => decide(true)}>Approve</button>
            </div>
          </>
        )}

        {state === 'approved' && (
          <>
            <h2 className="text-lg font-semibold text-online dark:text-online-dark">PC connected</h2>
            <p className="text-sm">{request?.deviceName} is now connected. You can close this tab and go back to the terminal.</p>
          </>
        )}

        {state === 'denied' && (
          <>
            <h2 className="text-lg font-semibold">Request denied</h2>
            <p className="text-sm">The PC was not connected.</p>
          </>
        )}

        {state === 'error' && <p className="text-sm text-danger dark:text-danger-dark">{error}</p>}

        {state !== 'ask' && state !== 'loading' && (
          <div className="flex justify-end">
            <Link className="btn" to="/" replace>Go to the dashboard</Link>
          </div>
        )}
      </div>
    </div>
  )
}
