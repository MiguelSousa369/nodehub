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
import { useMachines } from '../hooks/useMachines'
import { usePersistentState } from '../hooks/usePersistentState'
import { useToast } from '../hooks/useToast'
import { deleteMachine } from '../services/api'
import type { Machine } from '../types'
import { claudePrompt } from '../utils/machine'
import { byName } from '../utils/time'

const UNASSIGNED = 'Unassigned'

/** Above this many machines, client groups start collapsed (each can still be opened). */
const COLLAPSE_ABOVE = 40

type StatusFilter = 'all' | 'online' | 'offline' | 'unassigned'
type SortOrder    = 'name' | 'online' | 'recent'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'unassigned', label: UNASSIGNED },
]

const SORTS: Record<SortOrder, { label: string; compare: (a: Machine, b: Machine) => number }> = {
  name  : { label: 'Name', compare: (a, b) => byName(a.host, b.host) },
  online: { label: 'Online first', compare: (a, b) => Number(b.online) - Number(a.online) || byName(a.host, b.host) },
  recent: {
    label  : 'Recent session',
    compare: (a, b) => (b.lastSessionAt ?? '').localeCompare(a.lastSessionAt ?? '') || byName(a.host, b.host),
  },
}

function matchesText(m: Machine, text: string): boolean {
  return [m.host, m.client ?? '', m.notes, m.ip ?? ''].some((field) => field.toLowerCase().includes(text))
}

function matchesStatus(m: Machine, status: StatusFilter): boolean {
  if (status === 'online') return m.online
  if (status === 'offline') return !m.online
  if (status === 'unassigned') return !m.configured
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
  }), [machines])

  const defaultOpen = machines.length <= COLLAPSE_ABOVE
  const isOpen = (name: string) => filtering || name === UNASSIGNED || (openGroups[name] ?? defaultOpen)
  const setAll = (open: boolean) => setOpenGroups(Object.fromEntries(groups.map(([name]) => [name, open])))

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async function copy(m: Machine) {
    try {
      await navigator.clipboard.writeText(claudePrompt(m))
      toast.show('Copied. Paste it into Claude Code.')
    } catch {
      toast.show('Could not copy.')
    }
  }

  async function remove(m: Machine) {
    const warning = `Remove ${m.host} (${m.client}) from the dashboard?\n\n` +
      `The machine keeps its access. If it is still in the tailnet it shows up under "${UNASSIGNED}" again.`
    if (!confirm(warning)) return
    try {
      await deleteMachine(m.host)
      toast.show(`${m.host} removed.`)
      reload()
    } catch (e) {
      toast.show((e as Error).message)
    }
  }

  function saved(host: string) {
    setEditing(null)
    toast.show(`${host} saved.`)
    reload()
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  /** "1 client", "1,204 machines" */
  const count = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`

  return (
    <>
      <Header>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {loading ? 'Loading…' : (
            <>
              {count(clients.length, 'client')} · {count(machines.length, 'machine')} ·{' '}
              <span className="text-online dark:text-online-dark">{counts.online.toLocaleString()} online</span>
            </>
          )}
        </div>
        <div className="flex-1" />
        <button className="btn-primary gap-1.5" onClick={() => setAdding(true)}><Plus size={16} aria-hidden="true" />Add machine</button>
      </Header>

      <main id="main" tabIndex={-1} className="mx-auto outline-none max-w-7xl px-4 py-5 sm:px-6">
        {/* Toolbar: search, status, sort, expand/collapse */}
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <label className="relative w-full sm:w-72">
            <span className="sr-only">Search machines</span>
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" type="search" placeholder="Search machine, client, notes, IP…"
                   value={q} onChange={(e) => setParam('q', e.target.value, '')} />
          </label>

          <div role="radiogroup" aria-label="Status" className="flex flex-wrap gap-0.5 rounded-lg border border-slate-200 bg-surface-card p-0.5 dark:border-slate-700 dark:bg-surface-card-dark">
            {STATUS_OPTIONS.filter((o) => o.value !== 'unassigned' || counts.unassigned > 0).map((o) => (
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
                {o.label}
                {o.value === 'unassigned' && <span className="ml-1 tabular-nums">({counts.unassigned})</span>}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
            Sort
            <select className="input w-auto py-1.5" value={sort} onChange={(e) => setParam('sort', e.target.value, 'name')}>
              {Object.entries(SORTS).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <div className="flex-1" />
          <RefreshStatus updatedAt={updatedAt} refreshing={refreshing} onRefresh={reload} />
          {!filtering && groups.length > 1 && (
            <div className="flex gap-1">
              <button className="btn gap-1.5" onClick={() => setAll(true)} title="Expand all clients">
                <ChevronsUpDown size={15} aria-hidden="true" /><span className="hidden lg:inline">Expand all</span>
              </button>
              <button className="btn gap-1.5" onClick={() => setAll(false)} title="Collapse all clients">
                <ChevronsDownUp size={15} aria-hidden="true" /><span className="hidden lg:inline">Collapse all</span>
              </button>
            </div>
          )}
        </div>

        {(error || tailscaleError) && <Banner>{error ?? tailscaleError}</Banner>}
        {loading && <MachineGridSkeleton />}

        {!loading && machines.length === 0 && (
          <EmptyState
            icon={<MonitorUp size={22} />}
            title="No machines yet"
            action={<button className="btn-primary gap-1.5" onClick={() => setAdding(true)}><Plus size={16} aria-hidden="true" />Add machine</button>}
          >
            Download the installer, run it on a client PC, and the PC shows up here within a minute.
          </EmptyState>
        )}
        {!loading && machines.length > 0 && groups.length === 0 && (
          <EmptyState icon={<SearchX size={22} />} title="No machines match the filters"
                      action={<button className="btn" onClick={() => setParams({}, { replace: true })}>Clear filters</button>} />
        )}

        {groups.map(([name, list]) => (
          <ClientGroup
            key={name}
            name={name}
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
