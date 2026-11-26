import { Building2, History, Monitor, Search, Terminal, Users } from 'lucide-react'
import { KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { listMachines } from '../services/api'
import type { Machine } from '../types'
import { launcherLink, machinePath } from '../utils/machine'

/** Results shown at most: enough to pick from, and fast with thousands of machines. */
const MAX_RESULTS = 40

interface Result {
  key     : string
  icon    : ReactNode
  title   : string
  subtitle: string
  /** Enter */
  run     : () => void
  /** Shift+Enter, when there is a second action (machines: their page) */
  alt?    : () => void
  online? : boolean
}

interface CommandPaletteProps {
  open    : boolean
  onClose : () => void
  isAdmin : boolean
}

/** Machines whose host, client, notes or IP contain every word typed. */
function matches(m: Machine, words: string[]): boolean {
  const text = `${m.host} ${m.client ?? ''} ${m.notes} ${m.ip ?? ''}`.toLowerCase()
  return words.every((w) => text.includes(w))
}

// ---------------------------------------------------------------------------
// Quick search (Ctrl+K or /): find a machine and open it in Claude straight away, or jump to a
// client or a page. Enter runs the main action; Shift+Enter opens the machine's page instead.
// Built on <dialog> (showModal), so focus stays inside and Escape closes it.
// ---------------------------------------------------------------------------

export default function CommandPalette({ open, onClose, isAdmin }: CommandPaletteProps) {
  const navigate = useNavigate()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)
  const [query, setQuery]       = useState('')
  const [machines, setMachines] = useState<Machine[] | null>(null)
  const [active, setActive]     = useState(0)

  // Open / close the native dialog, and load a fresh machine list each time it opens
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open && !el.open) {
      setQuery('')
      setActive(0)
      el.showModal()
      inputRef.current?.focus()
      listMachines().then((list) => setMachines(list.machines)).catch(() => setMachines([]))
    }
    if (!open && el.open) el.close()
  }, [open])

  const results = useMemo<Result[]>(() => {
    const go = (path: string) => () => { onClose(); navigate(path) }
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)

    const pages: Result[] = [
      { key: 'p-machines', icon: <Monitor size={16} />, title: 'Machines', subtitle: 'Page', run: go('/') },
      { key: 'p-history', icon: <History size={16} />, title: 'History', subtitle: 'Page', run: go('/history') },
      ...(isAdmin ? [{ key: 'p-users', icon: <Users size={16} />, title: 'Users', subtitle: 'Page', run: go('/users') }] : []),
    ].filter((p) => words.every((w) => p.title.toLowerCase().includes(w)))

    if (!machines) return pages

    const found = machines.filter((m) => words.length === 0 ? m.configured : matches(m, words))
    // Online first: those are the ones you can work on right now
    found.sort((a, b) => Number(b.online) - Number(a.online) || a.host.localeCompare(b.host))

    const machineResults: Result[] = found.slice(0, MAX_RESULTS).map((m) => ({
      key     : `m-${m.host}`,
      icon    : <Terminal size={16} />,
      title   : m.host,
      subtitle: [m.client ?? 'Unassigned', m.online ? 'online' : 'offline', m.notes].filter(Boolean).join(' · '),
      online  : m.online,
      run     : m.configured
        ? () => { onClose(); window.location.href = launcherLink(m) }
        : go(`/?status=unassigned&q=${encodeURIComponent(m.host)}`),
      alt     : m.configured ? go(machinePath(m.host)) : undefined,
    }))

    const clientNames = [...new Set(machines.map((m) => m.client).filter((c): c is string => Boolean(c)))]
    const clientResults: Result[] = words.length === 0 ? [] : clientNames
      .filter((c) => words.every((w) => c.toLowerCase().includes(w)))
      .slice(0, 8)
      .map((c) => ({
        key     : `c-${c}`,
        icon    : <Building2 size={16} />,
        title   : c,
        subtitle: `Client · ${machines.filter((m) => m.client === c).length} machines`,
        run     : go(`/?q=${encodeURIComponent(c)}`),
      }))

    return [...machineResults, ...clientResults, ...pages]
  }, [query, machines, isAdmin, navigate, onClose])

  // Keep the highlighted row valid and visible
  useEffect(() => { setActive(0) }, [query])
  useEffect(() => {
    dialogRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((i) => (results.length ? (i + step + results.length) % results.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const r = results[active]
      if (!r) return
      if (e.shiftKey && r.alt) r.alt()
      else r.run()
    }
  }

  const activeId = results[active] ? `palette-${results[active].key}` : undefined

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => { if (e.target === dialogRef.current) onClose() }}   // click on the backdrop
      aria-label="Quick search"
      className="card mt-[12vh] w-[min(620px,calc(100vw-32px))] overflow-hidden p-0 text-slate-800 shadow-2xl dark:text-slate-200"
    >
      <div className="flex items-center gap-2.5 border-b border-slate-200 px-4 dark:border-slate-700/60">
        <Search size={18} aria-hidden="true" className="flex-none text-slate-400" />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-results"
          aria-activedescendant={activeId}
          aria-label="Search machines, clients and pages"
          placeholder="Search machines, clients, pages…"
          className="w-full bg-transparent py-3.5 text-base outline-none placeholder:text-slate-400"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <kbd className="hidden rounded border border-slate-200 px-1.5 text-[11px] text-slate-500 sm:block dark:border-slate-700">Esc</kbd>
      </div>

      <ul id="palette-results" role="listbox" aria-label="Results" className="max-h-[50vh] overflow-y-auto p-1.5">
        {machines === null && <li className="px-3 py-2 text-sm text-slate-500">Loading machines…</li>}
        {machines !== null && results.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">Nothing found.</li>}
        {results.map((r, i) => (
          <li
            key={r.key}
            id={`palette-${r.key}`}
            data-index={i}
            role="option"
            aria-selected={i === active}
            onMouseMove={() => setActive(i)}
            onClick={(e) => (e.shiftKey && r.alt ? r.alt() : r.run())}
            className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${i === active
              ? 'bg-brand/10 dark:bg-brand-dark/15' : ''}`}
          >
            <span className="relative flex-none text-slate-500 dark:text-slate-400" aria-hidden="true">
              {r.icon}
              {r.online !== undefined && (
                <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-surface-card dark:ring-surface-card-dark
                                  ${r.online ? 'bg-online dark:bg-online-dark' : 'bg-slate-400'}`} />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{r.title}</span>
              <span className="block truncate text-[12px] text-slate-500 dark:text-slate-400">{r.subtitle}</span>
            </span>
            {i === active && r.alt && <span className="hidden flex-none text-[11px] text-slate-500 sm:block dark:text-slate-400">Enter: Claude · Shift+Enter: page</span>}
          </li>
        ))}
      </ul>
    </dialog>
  )
}
