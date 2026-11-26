import { ChevronRight } from 'lucide-react'
import { useState } from 'react'

import type { Machine } from '../types'
import MachineCard from './MachineCard'

/** Cards rendered at first in a big group; the rest behind "Show all", so huge clients stay fast. */
const FIRST_PAGE = 60

interface ClientGroupProps {
  name       : string
  unassigned : boolean
  machines   : Machine[]
  open       : boolean
  /** When false (e.g. while searching) the group is always open and can't be collapsed. */
  collapsible: boolean
  onToggle   : () => void
  onConfigure: (m: Machine) => void
  onRemove   : (m: Machine) => void
  onCopy     : (m: Machine) => void
  onHistory  : (m: Machine) => void
}

// ---------------------------------------------------------------------------
// One client: a header (name, online count) that opens and closes the grid of machine cards.
// ---------------------------------------------------------------------------

export default function ClientGroup({ name, unassigned, machines, open, collapsible, onToggle, ...actions }: ClientGroupProps) {
  const [showAll, setShowAll] = useState(false)
  const online = machines.filter((m) => m.online).length
  const visible = showAll ? machines : machines.slice(0, FIRST_PAGE)
  const panelId = `group-${name.replace(/\W+/g, '-')}`

  return (
    <section className="mb-3" aria-label={name}>
      <h2>
        <button
          type="button"
          onClick={onToggle}
          disabled={!collapsible}
          aria-expanded={open}
          aria-controls={panelId}
          className="group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition
                     hover:bg-slate-900/[0.03] disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-white/[0.03]"
        >
          {collapsible && (
            <ChevronRight size={16} aria-hidden="true"
                          className={`flex-none text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
          )}
          <span className={`truncate text-sm font-semibold uppercase tracking-wider ${unassigned
            ? 'text-warn dark:text-warn-dark'
            : 'text-slate-600 dark:text-slate-300'}`}>
            {name}
          </span>
          <span
            className={`flex-none rounded-full px-2 py-0.5 text-[12px] font-medium tabular-nums ${online > 0
              ? 'bg-online/10 text-online dark:text-online-dark'
              : 'bg-slate-200/70 text-slate-500 dark:bg-slate-700/50 dark:text-slate-400'}`}
            title={`${online} of ${machines.length} online`}
          >
            {online}/{machines.length} online
          </span>
          {unassigned && <span className="text-[12px] text-warn dark:text-warn-dark">needs configuring</span>}
          <span className="flex-1 border-t border-slate-200/80 dark:border-slate-700/50" aria-hidden="true" />
        </button>
      </h2>

      {open && (
        <div id={panelId} className="px-0 pb-4 pt-1.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
            {visible.map((m) => <MachineCard key={m.host} machine={m} {...actions} />)}
          </div>
          {visible.length < machines.length && (
            <div className="mt-3 text-center">
              <button className="btn" onClick={() => setShowAll(true)}>Show all {machines.length} machines</button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
