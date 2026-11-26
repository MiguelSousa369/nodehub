import { ClipboardList, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

import { Banner, EmptyState, ListSkeleton } from '../components/Feedback'
import Header from '../components/Header'
import SessionItem from '../components/SessionItem'
import { useAuth, useUser } from '../context/AuthContext'
import { ApiError, listSessions, listTechnicians } from '../services/api'
import { Messages, useI18n } from '../i18n'
import type { Session, SessionResult, Technician } from '../types'
import { longDay } from '../utils/time'

const PAGE_SIZE = 50

const RESULTS: (SessionResult | '')[] = ['', 'FIXED', 'PARTIAL', 'UNRESOLVED']

/** "Today", "Yesterday" or a full date, for the day headings. */
function dayLabel(date: Date, t: Messages): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return t.history.today
  if (date.toDateString() === yesterday.toDateString()) return t.history.yesterday
  return longDay(date)
}

/** Splits sessions (newest first) into consecutive days. */
function byDay(sessions: Session[], t: Messages): [string, Session[]][] {
  const days: [string, Session[]][] = []
  for (const s of sessions) {
    const label = dayLabel(new Date(s.createdAt), t)
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
  const { t } = useI18n()
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

  const days = useMemo(() => byDay(sessions, t), [sessions, t])
  const filtering = Boolean(q || result || technician || host)

  // "Me" first in the technician list, even before I've recorded anything
  const technicianOptions = useMemo(() => {
    const others = technicians.filter((t) => t.id !== user.id)
    return [{ id: user.id, name: t.history.me(user.name) }, ...others]
  }, [technicians, user, t])

  return (
    <>
      <Header>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {loading && sessions.length === 0 ? t.common.loading : t.history.count(total)}
        </div>
      </Header>

      <main id="main" tabIndex={-1} className="mx-auto outline-none max-w-5xl px-4 py-5 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center gap-2.5">
          <label className="relative w-full sm:w-72">
            <span className="sr-only">{t.history.searchLabel}</span>
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" type="search" placeholder={t.history.searchPlaceholder}
                   value={q} onChange={(e) => setParam('q', e.target.value)} />
          </label>

          <label>
            <span className="sr-only">{t.history.result}</span>
            <select className="input w-auto" value={result} onChange={(e) => setParam('result', e.target.value)}>
              {RESULTS.map((r) => <option key={r} value={r}>{r ? t.session[r] : t.history.allResults}</option>)}
            </select>
          </label>

          <label>
            <span className="sr-only">{t.history.technician}</span>
            <select className="input w-auto" value={technician} onChange={(e) => setParam('technician', e.target.value)}>
              <option value="">{t.history.allTechnicians}</option>
              {technicianOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>

          {host && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 py-1 pl-3 pr-1 text-sm text-brand dark:bg-brand-dark/15 dark:text-brand-dark">
              {t.history.machine} <b>{host}</b>
              <button type="button" aria-label={t.history.allMachines} onClick={() => setParam('host', '')}
                      className="rounded-full p-0.5 hover:bg-brand/15"><X size={14} aria-hidden="true" /></button>
            </span>
          )}

          {filtering && (
            <button className="btn" onClick={() => setParams({}, { replace: true })}>{t.common.clearFilters}</button>
          )}
        </div>

        {error && <Banner>{error}</Banner>}
        {loading && sessions.length === 0 && <ListSkeleton label={t.history.loading} />}
        {!loading && sessions.length === 0 && (
          <EmptyState icon={<ClipboardList size={22} />} title={filtering ? t.history.noMatchTitle : t.history.noneTitle}>
            {filtering ? t.history.noMatchText : t.history.noneText}
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
              {loading ? t.common.loading : t.history.loadMoreLeft(total - sessions.length)}
            </button>
          </div>
        )}
      </main>
    </>
  )
}
