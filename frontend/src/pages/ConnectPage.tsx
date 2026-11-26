import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import Logo from '../components/Logo'
import { useAuth, useUser } from '../context/AuthContext'
import { useI18n } from '../i18n'
import { ApiError, decideCliLogin, getCliLogin } from '../services/api'
import type { CliLoginRequest } from '../types'

type State = 'loading' | 'ask' | 'approved' | 'denied' | 'error'

/** Approval page opened by "nodehub login": connects a PC to the signed-in account. */
export default function ConnectPage() {
  const user = useUser()
  const { logout: onLogout } = useAuth()
  const { t } = useI18n()
  const code = useSearchParams()[0].get('code') ?? ''
  const [request, setRequest] = useState<CliLoginRequest | null>(null)
  const [state, setState]     = useState<State>('loading')
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!code) {
      setError(t.connect.noCode)
      setState('error')
      return
    }
    getCliLogin(code)
      .then((r) => {
        setRequest(r)
        setState(r.status === 'PENDING' ? 'ask' : 'error')
        if (r.status !== 'PENDING') setError(t.connect.answered)
      })
      .catch((e: Error) => {
        if (e instanceof ApiError && e.code === 'UNAUTHORIZED') return onLogout()
        setError(e.message)
        setState('error')
      })
  }, [code, onLogout, t])

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
    <main id="main" className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md space-y-4 p-6">
        <h1><Logo /></h1>

        {state === 'loading' && <p className="text-sm text-slate-500">{t.common.loading}</p>}

        {state === 'ask' && request && (
          <>
            <h2 className="text-lg font-semibold">{t.connect.title}</h2>
            <p className="text-sm">{t.connect.asking(request.deviceName, user.name, user.username)}</p>
            <div className="rounded-lg bg-surface p-3 text-center dark:bg-surface-dark">
              <div className="text-[13px] text-slate-500 dark:text-slate-400">{t.connect.checkCode}</div>
              <div className="font-mono text-2xl font-semibold tracking-widest">{request.userCode}</div>
            </div>
            <p className="text-[13px] text-slate-500 dark:text-slate-400">{t.connect.onlyApprove}</p>
            <div className="flex justify-end gap-2">
              <button className="btn" onClick={() => decide(false)}>{t.connect.deny}</button>
              <button className="btn-primary" onClick={() => decide(true)}>{t.connect.approve}</button>
            </div>
          </>
        )}

        {state === 'approved' && (
          <>
            <h2 className="text-lg font-semibold text-online dark:text-online-dark">{t.connect.connected}</h2>
            <p className="text-sm">{t.connect.connectedText(request?.deviceName ?? '')}</p>
          </>
        )}

        {state === 'denied' && (
          <>
            <h2 className="text-lg font-semibold">{t.connect.denied}</h2>
            <p className="text-sm">{t.connect.deniedText}</p>
          </>
        )}

        {state === 'error' && <p className="text-sm text-danger dark:text-danger-dark">{error}</p>}

        {state !== 'ask' && state !== 'loading' && (
          <div className="flex justify-end">
            <Link className="btn" to="/" replace>{t.connect.goDashboard}</Link>
          </div>
        )}
      </div>
    </main>
  )
}
