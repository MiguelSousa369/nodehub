import { ClipboardList, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

import { Banner, EmptyState, ListSkeleton } from '../components/Feedback'
import Header from '../components/Header'
import SessionItem from '../components/SessionItem'
import { useAuth, useUser } from '../context/AuthContext'
import { ApiError, listSessions, listTechnicians } from '../services/api'
import type { Session, SessionResult, Technician } from '../types'

const PAGE_SIZE = 50

const RESULTS: { value: SessionResult | ''; label: string }[] = [
  { value: '', label: 'All results' },
  { value: 'FIXED', label: 'Fixed' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'UNRESOLVED', label: 'Unresolved' },
]

/** "Today", "Yesterday" or a full date, for the day headings. */
function dayLabel(date: Date): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/** Splits sessions (newest first) into consecutive days. */
function byDay(sessions: Session[]): [string, Session[]][] {
  const days: [string, Session[]][] = []
  for (const s of sessions) {
    const label = dayLabel(new Date(s.createdAt))
    const last = days[days.length - 1]
    if (last && last[0] === label) last[1].push(s)
    else days.push([label, [s]])
  }
  return days
}

// ---------------------------------------------------------------------------
// Helpdesk sessions across all machines, newest first, grouped by day.
// Filters live in the URL (?q=&result=&technician=&host=) so a view can be bookmarked or shared;
// machine pages link here with ?host=.
// ---------------------------------------------------------------------------

export default function HistoryPage() {
  const user = useUser()
  const { logout } = useAuth()
  const [params, setParams] = useSearchParams()
  const [sessions, setSessions]       = useState<Session[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [total, setTotal]             = useState(0)
  const [error, setError]             = useState<string | null>(null)
  const [loading, setLoading]         = useState(true)

  const q          = params.get('q') ?? ''
  const result     = (params.get('result') ?? '') as SessionResult | ''
  const technician = params.get('technician') ?? ''
  const host       = params.get('host') ?? ''

  function setParam(key: string, value: string) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: true })
  }

  useEffect(() => {
    listTechnicians().then(setTechnicians).catch(() => { /* the filter just stays short */ })
  }, [])

  const load = useCallback(async (offset: number) => {
    setLoading(true)
    try {
      const page = await listSessions({
        q           : q.trim() || undefined,
        result,
        technicianId: technician ? Number(technician) : undefined,
        host        : host || undefined,
        limit       : PAGE_SIZE,
        offset,
      })
      setSessions((prev) => (offset === 0 ? page.sessions : [...prev, ...page.sessions]))
      setTotal(page.total)
      setError(null)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'UNAUTHORIZED') return logout()
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [q, result, technician, host, logout])

  // Reload from the start when a filter changes (debounced for the text search)
  useEffect(() => {
    const id = setTimeout(() => load(0), 300)
    return () => clearTimeout(id)
  }, [load])

  const days = useMemo(() => byDay(sessions), [sessions])
  const filtering = Boolean(q || result || technician || host)

  // "Me" first in the technician list, even before I've recorded anything
  const technicianOptions = useMemo(() => {
    const others = technicians.filter((t) => t.id !== user.id)
    return [{ id: user.id, name: `${user.name} (me)` }, ...others]
  }, [technicians, user])

  return (
    <>
      <Header>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {loading && sessions.length === 0 ? 'Loading…' : `${total.toLocaleString()} sessions`}
        </div>
      </Header>

      <main id="main" tabIndex={-1} className="mx-auto outline-none max-w-5xl px-4 py-5 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center gap-2.5">
          <label className="relative w-full sm:w-72">
            <span className="sr-only">Search sessions</span>
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" type="search" placeholder="Search machine, problem, actions…"
                   value={q} onChange={(e) => setParam('q', e.target.value)} />
          </label>

          <label>
            <span className="sr-only">Result</span>
            <select className="input w-auto" value={result} onChange={(e) => setParam('result', e.target.value)}>
              {RESULTS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>

          <label>
            <span className="sr-only">Technician</span>
            <select className="input w-auto" value={technician} onChange={(e) => setParam('technician', e.target.value)}>
              <option value="">All technicians</option>
              {technicianOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>

          {host && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 py-1 pl-3 pr-1 text-sm text-brand dark:bg-brand-dark/15 dark:text-brand-dark">
              Machine: <b>{host}</b>
              <button type="button" aria-label="Show all machines" onClick={() => setParam('host', '')}
                      className="rounded-full p-0.5 hover:bg-brand/15"><X size={14} aria-hidden="true" /></button>
            </span>
          )}

          {filtering && (
            <button className="btn" onClick={() => setParams({}, { replace: true })}>Clear filters</button>
          )}
        </div>

        {error && <Banner>{error}</Banner>}
        {loading && sessions.length === 0 && <ListSkeleton label="Loading sessions" />}
        {!loading && sessions.length === 0 && (
          <EmptyState icon={<ClipboardList size={22} />} title={filtering ? 'No sessions match the filters' : 'No sessions yet'}>
            {filtering
              ? 'Try another search or clear the filters.'
              : <>Sessions appear here when Claude records them at the end of a helpdesk session (<code>nodehub log</code>).</>}
          </EmptyState>
        )}

        <div className="space-y-6">
          {days.map(([label, list]) => (
            <section key={label} aria-label={label}>
              <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {label} <span className="font-normal normal-case tracking-normal">· {list.length}</span>
              </h2>
              <div className="space-y-2">
                {list.map((s) => <SessionItem key={s.id} session={s} showHost timeOnly />)}
              </div>
            </section>
          ))}
        </div>

        {sessions.length < total && (
          <div className="mt-5 text-center">
            <button className="btn" disabled={loading} onClick={() => load(sessions.length)}>
              {loading ? 'Loading…' : `Load more (${(total - sessions.length).toLocaleString()} left)`}
            </button>
          </div>
        )}
      </main>
    </>
  )
}
