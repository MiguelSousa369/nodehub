import { ArrowLeft, ClipboardList, Copy, Pencil, Terminal } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'

import { Banner, EmptyState, ListSkeleton } from '../components/Feedback'
import Header from '../components/Header'
import MachineFormDialog from '../components/MachineFormDialog'
import Markdown from '../components/Markdown'
import SessionItem from '../components/SessionItem'
import Toast from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../hooks/useToast'
import { ApiError, getMachine, listMachines, listSessions, updateProfile } from '../services/api'
import type { Machine, MachineDetail, Session } from '../types'
import { claudePrompt, launcherLink } from '../utils/machine'
import { fullDate, timeAgo } from '../utils/time'

const PAGE_SIZE = 20

const PROFILE_TEMPLATE = '- **Role:** server / workstation\n- **OS:**\n- **Hardware:**\n- **Important software:**\n- **Quirks:**'

// ---------------------------------------------------------------------------
// One machine (/machines/:host): live status, profile (editable) and its full session history.
// ---------------------------------------------------------------------------

export default function MachinePage() {
  const host = useParams().host ?? ''
  const { logout } = useAuth()
  const toast = useToast()
  const [detail, setDetail]     = useState<MachineDetail | null>(null)
  const [live, setLive]         = useState<Machine | null>(null)   // status from Tailscale
  const [clients, setClients]   = useState<string[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [error, setError]       = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [draft, setDraft]       = useState('')
  const [editing, setEditing]   = useState(false)

  const fail = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.code === 'UNAUTHORIZED') return logout()
    setError((e as Error).message)
  }, [logout])

  const load = useCallback(() => {
    setError(null)
    getMachine(host)
      .then((d) => { setDetail(d); setSessions(d.recentSessions) })
      .catch(fail)
    listMachines()
      .then((list) => {
        setLive(list.machines.find((m) => m.host.toLowerCase() === host.toLowerCase()) ?? null)
        setClients(list.clients)
      })
      .catch(() => { /* status is a bonus; the page works without it */ })
  }, [host, fail])

  useEffect(() => {
    setDetail(null)
    setEditingProfile(false)
    load()
  }, [load])

  async function loadMore() {
    try {
      const page = await listSessions({ host, limit: PAGE_SIZE, offset: sessions.length })
      setSessions((prev) => [...prev, ...page.sessions])
    } catch (e) {
      fail(e)
    }
  }

  async function saveProfile() {
    try {
      await updateProfile(host, draft)
      setDetail((d) => (d ? { ...d, profile: draft } : d))
      setEditingProfile(false)
      toast.show('Profile saved.')
    } catch (e) {
      fail(e)
    }
  }

  async function copy() {
    if (!detail) return
    try {
      await navigator.clipboard.writeText(claudePrompt({ ...detail, ip: live?.ip }))
      toast.show('Copied. Paste it into Claude Code.')
    } catch {
      toast.show('Could not copy.')
    }
  }

  // The edit dialog works on the dashboard's Machine shape (memoised: the dialog resets its form when it changes)
  const asMachine = useMemo<Machine | null>(() => detail && {
    host: detail.host, client: detail.client, sshUser: detail.sshUser, notes: detail.notes, configured: true,
    inTailnet: live?.inTailnet ?? false, online: live?.online ?? false, ip: live?.ip ?? null, os: live?.os ?? null,
    lastSeen: live?.lastSeen ?? null, lastSessionAt: live?.lastSessionAt ?? null,
  }, [detail, live])

  return (
    <>
      <Header />

      <main id="main" tabIndex={-1} className="mx-auto outline-none max-w-5xl px-4 py-5 sm:px-6">
        <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
          <ArrowLeft size={15} aria-hidden="true" />Machines
        </Link>

        {error && <Banner>{error}</Banner>}
        {!detail && !error && <ListSkeleton rows={4} label="Loading machine" />}

        {detail && (
          <div className="space-y-5">
            {/* Title, status and actions */}
            <section className="card flex flex-wrap items-start gap-4 p-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <span aria-hidden="true" className={`h-3 w-3 flex-none rounded-full ${live?.online
                    ? 'beat bg-online dark:bg-online-dark' : 'bg-slate-300 dark:bg-slate-600'}`} />
                  <h1 className="truncate text-2xl font-semibold">{detail.host}</h1>
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  <Link to={`/?q=${encodeURIComponent(detail.client)}`} className="font-medium hover:underline">{detail.client}</Link>
                  {' · '}
                  {live?.online ? <span className="text-online dark:text-online-dark">Online</span>
                    : live?.inTailnet ? `Offline${live.lastSeen ? ` · seen ${timeAgo(live.lastSeen)}` : ''}`
                    : live ? 'Not found in the tailnet' : 'Status unknown'}
                  {live?.ip && ` · ${live.ip}`}
                  {` · SSH user ${detail.sshUser}`}
                </p>
                {detail.notes && <p className="mt-1 text-sm italic text-slate-500 dark:text-slate-400">{detail.notes}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <a className="btn-primary gap-1.5" href={launcherLink(detail)}><Terminal size={15} aria-hidden="true" />Open in Claude</a>
                <button className="btn gap-1.5" onClick={copy}><Copy size={15} aria-hidden="true" />Copy</button>
                <button className="btn gap-1.5" onClick={() => setEditing(true)}><Pencil size={15} aria-hidden="true" />Edit</button>
              </div>
            </section>

            {/* Profile */}
            <section className="card p-5" aria-labelledby="profile-title">
              <div className="mb-3 flex items-center justify-between">
                <h2 id="profile-title" className="font-semibold">Profile</h2>
                {!editingProfile && (
                  <button className="btn gap-1.5" onClick={() => { setDraft(detail.profile || PROFILE_TEMPLATE); setEditingProfile(true) }}>
                    <Pencil size={14} aria-hidden="true" />Edit
                  </button>
                )}
              </div>
              {editingProfile ? (
                <>
                  <label className="mb-1 block text-[13px] text-slate-500 dark:text-slate-400" htmlFor="profile-text">
                    Markdown: <code>**bold**</code>, <code>- list item</code>
                  </label>
                  <textarea id="profile-text" className="input min-h-[200px] font-mono" value={draft} onChange={(e) => setDraft(e.target.value)} />
                  <div className="mt-2 flex justify-end gap-2">
                    <button className="btn" onClick={() => setEditingProfile(false)}>Cancel</button>
                    <button className="btn-primary" onClick={saveProfile}>Save profile</button>
                  </div>
                </>
              ) : detail.profile ? (
                <Markdown>{detail.profile}</Markdown>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">No profile yet. Claude fills it in during sessions, or edit it here.</p>
              )}
              {detail.profile && !editingProfile && (
                <p className="mt-3 text-[12px] text-slate-500 dark:text-slate-400" title={fullDate(detail.updatedAt)}>
                  Machine record updated {timeAgo(detail.updatedAt)}
                </p>
              )}
            </section>

            {/* Sessions */}
            <section aria-labelledby="sessions-title">
              <div className="mb-2.5 flex items-center justify-between">
                <h2 id="sessions-title" className="font-semibold">
                  Sessions <span className="font-normal text-slate-500">({detail.totalSessions})</span>
                </h2>
                {detail.totalSessions > 0 && (
                  <Link to={`/history?host=${encodeURIComponent(detail.host)}`} className="text-sm text-brand hover:underline dark:text-brand-dark">
                    Search in history
                  </Link>
                )}
              </div>
              {sessions.length === 0 ? (
                <EmptyState icon={<ClipboardList size={22} />} title="No sessions recorded yet">
                  Claude records a session here at the end of each helpdesk session on this machine.
                </EmptyState>
              ) : (
                <div className="space-y-2">{sessions.map((s) => <SessionItem key={s.id} session={s} />)}</div>
              )}
              {sessions.length < detail.totalSessions && (
                <div className="mt-3 text-center">
                  <button className="btn" onClick={loadMore}>Load more</button>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <MachineFormDialog machine={editing ? asMachine : null} clients={clients} onClose={() => setEditing(false)}
                         onSaved={() => { setEditing(false); toast.show('Machine saved.'); load() }} />
      <Toast message={toast.message} />
    </>
  )
}
