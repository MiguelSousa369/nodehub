import type { Machine } from '../types'
import MachineCard from './MachineCard'

interface ClientGroupProps {
  name       : string
  unassigned : boolean
  machines   : Machine[]
  onConfigure: (m: Machine) => void
  onRemove   : (m: Machine) => void
  onCopy     : (m: Machine) => void
}

export default function ClientGroup({ name, unassigned, machines, ...actions }: ClientGroupProps) {
  return (
    <section className="mb-7">
      <h2 className={`mb-2.5 text-sm font-semibold uppercase tracking-wider ${unassigned
        ? 'text-warn dark:text-warn-dark'
        : 'text-slate-500 dark:text-slate-400'}`}>
        {name}
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
        {machines.map((m) => <MachineCard key={m.host} machine={m} {...actions} />)}
      </div>
    </section>
  )
}
