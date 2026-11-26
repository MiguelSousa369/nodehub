import { useCallback, useEffect, useState } from 'react'

import Header from '../components/Header'
import SessionItem from '../components/SessionItem'
import { ApiError, listSessions } from '../services/api'
import { useAuth, useUser } from '../context/AuthContext'
import type { Session, SessionResult } from '../types'

const PAGE_SIZE = 50

/** Helpdesk sessions across all machines, newest first, with filters. */
export default function HistoryPage() {
  const user = useUser()
  const { logout: onLogout } = useAuth()
  const [q, setQ]               = useState('')
  const [result, setResult]     = useState<SessionResult | ''>('')
  const [mineOnly, setMineOnly] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [total, setTotal]       = useState(0)
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async (offset: number) => {
    setLoading(true)
    try {
      const page = await listSessions({
        q: q.trim() || undefined, result, technicianId: mineOnly ? user.id : undefined, limit: PAGE_SIZE, offset,
      })
      setSessions((prev) => (offset === 0 ? page.sessions : [...prev, ...page.sessions]))
      setTotal(page.total)
      setError(null)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'UNAUTHORIZED') return onLogout()
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [q, result, mineOnly, user.id, onLogout])

  // Reload from the start when a filter changes (debounced for the text search)
  useEffect(() => {
    const id = setTimeout(() => load(0), 300)
    return () => clearTimeout(id)
  }, [load])

  return (
    <>
      <Header>
        <div className="text-sm text-slate-500 dark:text-slate-400">{loading ? 'loading…' : `${total} sessions`}</div>
        <div className="flex-1" />
      </Header>

      <main className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input className="input w-full sm:w-72" type="search" placeholder="Search machine, problem, actions…"
                 value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input w-auto" value={result} onChange={(e) => setResult(e.target.value as SessionResult | '')}>
            <option value="">All results</option>
            <option value="FIXED">Fixed</option>
            <option value="PARTIAL">Partial</option>
            <option value="UNRESOLVED">Unresolved</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
            Only my sessions
          </label>
        </div>

        {error && <div className="mb-4 text-sm text-warn dark:text-warn-dark">{error}</div>}
        {!loading && sessions.length === 0 && <div className="py-8 text-center text-slate-500">No sessions found.</div>}

        <div className="space-y-2">
          {sessions.map((s) => <SessionItem key={s.id} session={s} showHost />)}
        </div>

        {sessions.length < total && (
          <div className="mt-4 text-center">
            <button className="btn" disabled={loading} onClick={() => load(sessions.length)}>Load more</button>
          </div>
        )}
      </main>
    </>
  )
}
