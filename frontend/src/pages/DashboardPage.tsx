import { ChevronsDownUp, ChevronsUpDown, MonitorUp, Plus, Search, SearchX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

import AddMachineDialog from '../components/AddMachineDialog'
import ClientGroup from '../components/ClientGroup'
import { Banner, EmptyState, MachineGridSkeleton } from '../components/Feedback'
import Header from '../components/Header'
import MachineFormDialog from '../components/MachineFormDialog'
import RefreshStatus from '../components/RefreshStatus'
import Toast from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import { Messages, useI18n } from '../i18n'
import { useMachines } from '../hooks/useMachines'
import { usePersistentState } from '../hooks/usePersistentState'
import { useToast } from '../hooks/useToast'
import { deleteMachine } from '../services/api'
import type { Machine } from '../types'
import { copyText } from '../utils/clipboard'
import { claudePrompt, isNew, machineLabel } from '../utils/machine'
import { byName } from '../utils/time'

/** Group key for machines without a client (never a real client name: those can't start with a NUL). */
const UNASSIGNED = '\u0000unassigned'

/** Above this many machines, client groups start collapsed (each can still be opened). */
const COLLAPSE_ABOVE = 40

type StatusFilter = 'all' | 'online' | 'offline' | 'new' | 'unassigned'
type SortOrder    = 'name' | 'online' | 'recent'

const STATUS_OPTIONS: { value: StatusFilter; label: (t: Messages) => string }[] = [
  { value: 'all', label: (t) => t.dashboard.all },
  { value: 'online', label: (t) => t.common.online },
  { value: 'offline', label: (t) => t.common.offline },
  { value: 'new', label: (t) => t.dashboard.statusNew },
  { value: 'unassigned', label: (t) => t.common.unassigned },
]

const SORTS: Record<SortOrder, { label: (t: Messages) => string; compare: (a: Machine, b: Machine) => number }> = {
  name  : { label: (t) => t.dashboard.sortName, compare: (a, b) => byName(machineLabel(a), machineLabel(b)) },
  online: {
    label  : (t) => t.dashboard.sortOnline,
    compare: (a, b) => Number(b.online) - Number(a.online) || byName(machineLabel(a), machineLabel(b)),
  },
  recent: {
    label  : (t) => t.dashboard.sortRecent,
    compare: (a, b) => (b.lastSessionAt ?? '').localeCompare(a.lastSessionAt ?? '') || byName(machineLabel(a), machineLabel(b)),
  },
}

function matchesText(m: Machine, text: string): boolean {
  return [m.host, m.displayName, m.client ?? '', m.notes, m.ip ?? ''].some((field) => field.toLowerCase().includes(text))
}

function matchesStatus(m: Machine, status: StatusFilter): boolean {
  if (status === 'online') return m.online
  if (status === 'offline') return !m.online
  if (status === 'unassigned') return !m.configured
  if (status === 'new') return isNew(m)
  return true
}

// ---------------------------------------------------------------------------
// Machines, grouped by client.
//
// Built for many clients: groups collapse when there are lots of machines (remembered per client),
// big groups render in pages, and search / status / sort live in the URL (?q=&status=&sort=) so a
// filtered view can be bookmarked or shared.
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { logout } = useAuth()
  const { t } = useI18n()
  const { machines, clients, tailscaleError, error, loading, refreshing, updatedAt, reload } = useMachines(logout)
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [adding, setAdding]         = useState(false)
  const [editing, setEditing]       = useState<Machine | null>(null)
  // Per-client open/closed choice; clients not in here follow the default for the fleet size
  const [openGroups, setOpenGroups] = usePersistentState<Record<string, boolean>>('nodehub.openGroups', {})

  const q      = params.get('q') ?? ''
  const status = (params.get('status') as StatusFilter | null) ?? 'all'
  const sort   = (params.get('sort') as SortOrder | null) ?? 'name'

  /** Updates one query parameter, dropping it when it's back to its default. */
  function setParam(key: string, value: string, fallback: string) {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value === fallback) next.delete(key)
      else next.set(key, value)
      return next
    }, { replace: true })
  }

  // ---------------------------------------------------------------------------
  // Filtering, grouping and sorting
  // ---------------------------------------------------------------------------

  const text = q.trim().toLowerCase()
  const filtering = text !== '' || status !== 'all'

  const groups = useMemo(() => {
    const compare = (SORTS[sort] ?? SORTS.name).compare
    const map = new Map<string, Machine[]>()
    for (const m of machines) {
      if (!matchesStatus(m, status) || (text && !matchesText(m, text))) continue
      const name = m.client ?? UNASSIGNED
      const list = map.get(name)
      if (list) list.push(m)
      else map.set(name, [m])
    }
    // Unassigned first (it needs attention), then clients by name
    return [...map.entries()]
      .map(([name, list]) => [name, list.sort(compare)] as const)
      .sort(([a], [b]) => Number(b === UNASSIGNED) - Number(a === UNASSIGNED) || byName(a, b))
  }, [machines, status, text, sort])

  const counts = useMemo(() => ({
    online    : machines.filter((m) => m.online).length,
    unassigned: machines.filter((m) => !m.configured).length,
    new       : machines.filter(isNew).length,
  }), [machines])

  const defaultOpen = machines.length <= COLLAPSE_ABOVE
  const isOpen = (name: string) => filtering || name === UNASSIGNED || (openGroups[name] ?? defaultOpen)
  const setAll = (open: boolean) => setOpenGroups(Object.fromEntries(groups.map(([name]) => [name, open])))

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async function copy(m: Machine) {
    try {
      await copyText(claudePrompt(m))
      toast.show(t.common.copied)
    } catch {
      toast.show(t.common.copyFailed)
    }
  }

  async function remove(m: Machine) {
    if (!confirm(t.dashboard.removeConfirm(machineLabel(m), m.client ?? '', t.common.unassigned))) return
    try {
      await deleteMachine(m.host)
      toast.show(t.dashboard.removed(machineLabel(m)))
      reload()
    } catch (e) {
      toast.show((e as Error).message)
    }
  }

  function saved(host: string) {
    setEditing(null)
    toast.show(t.dashboard.saved(host))
    reload()
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <Header>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {loading ? t.common.loading : (
            <>
              {t.dashboard.clients(clients.length)} · {t.dashboard.machines(machines.length)} ·{' '}
              <span className="text-online dark:text-online-dark">{t.dashboard.onlineCount(counts.online)}</span>
            </>
          )}
        </div>
        <div className="flex-1" />
        <button className="btn-primary gap-1.5" onClick={() => setAdding(true)}><Plus size={16} aria-hidden="true" />{t.dashboard.addMachine}</button>
      </Header>

      <main id="main" tabIndex={-1} className="mx-auto outline-none max-w-7xl px-4 py-5 sm:px-6">
        {/* Toolbar: search, status, sort, expand/collapse */}
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <label className="relative w-full sm:w-72">
            <span className="sr-only">{t.dashboard.searchLabel}</span>
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" type="search" placeholder={t.dashboard.searchPlaceholder}
                   value={q} onChange={(e) => setParam('q', e.target.value, '')} />
          </label>

          <div role="radiogroup" aria-label={t.dashboard.status} className="flex flex-wrap gap-0.5 rounded-lg border border-slate-200 bg-surface-card p-0.5 dark:border-slate-700 dark:bg-surface-card-dark">
            {STATUS_OPTIONS.filter((o) => (o.value !== 'unassigned' || counts.unassigned > 0) && (o.value !== 'new' || counts.new > 0)).map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={status === o.value}
                onClick={() => setParam('status', o.value, 'all')}
                className={`rounded-md px-2.5 py-1 text-sm transition ${status === o.value
                  ? 'bg-brand/10 font-semibold text-brand dark:bg-brand-dark/15 dark:text-brand-dark'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
              >
                {o.label(t)}
                {o.value === 'unassigned' && <span className="ml-1 tabular-nums">({counts.unassigned})</span>}
                {o.value === 'new' && <span className="ml-1 tabular-nums">({counts.new})</span>}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
            {t.dashboard.sort}
            <select className="input w-auto py-1.5" value={sort} onChange={(e) => setParam('sort', e.target.value, 'name')}>
              {Object.entries(SORTS).map(([value, { label }]) => <option key={value} value={value}>{label(t)}</option>)}
            </select>
          </label>

          <div className="flex-1" />
          <RefreshStatus updatedAt={updatedAt} refreshing={refreshing} onRefresh={reload} />
          {!filtering && groups.length > 1 && (
            <div className="flex gap-1">
              <button className="btn gap-1.5" onClick={() => setAll(true)} title={t.dashboard.expandAllTitle}>
                <ChevronsUpDown size={15} aria-hidden="true" /><span className="hidden lg:inline">{t.dashboard.expandAll}</span>
              </button>
              <button className="btn gap-1.5" onClick={() => setAll(false)} title={t.dashboard.collapseAllTitle}>
                <ChevronsDownUp size={15} aria-hidden="true" /><span className="hidden lg:inline">{t.dashboard.collapseAll}</span>
              </button>
            </div>
          )}
        </div>

        {error && <Banner>{error}</Banner>}
        {!error && tailscaleError && <Banner><span title={tailscaleError}>{t.errors.TAILSCALE_UNAVAILABLE}</span></Banner>}
        {loading && <MachineGridSkeleton />}

        {!loading && machines.length === 0 && (
          <EmptyState
            icon={<MonitorUp size={22} />}
            title={t.dashboard.emptyTitle}
            action={<button className="btn-primary gap-1.5" onClick={() => setAdding(true)}><Plus size={16} aria-hidden="true" />{t.dashboard.addMachine}</button>}
          >
            {t.dashboard.emptyText}
          </EmptyState>
        )}
        {!loading && machines.length > 0 && groups.length === 0 && (
          <EmptyState icon={<SearchX size={22} />} title={t.dashboard.noMatchTitle}
                      action={<button className="btn" onClick={() => setParams({}, { replace: true })}>{t.common.clearFilters}</button>} />
        )}

        {groups.map(([name, list]) => (
          <ClientGroup
            key={name}
            name={name === UNASSIGNED ? t.common.unassigned : name}
            unassigned={name === UNASSIGNED}
            machines={list}
            open={isOpen(name)}
            collapsible={!filtering && name !== UNASSIGNED}
            onToggle={() => setOpenGroups((prev) => ({ ...prev, [name]: !isOpen(name) }))}
            onConfigure={setEditing}
            onRemove={remove}
            onCopy={copy}
          />
        ))}
      </main>

      <AddMachineDialog open={adding} onClose={() => setAdding(false)} />
      <MachineFormDialog machine={editing} clients={clients} onClose={() => setEditing(null)} onSaved={saved} />
      <Toast message={toast.message} />
    </>
  )
}
