import { useMemo, useState } from 'react'

import AddMachineDialog from '../components/AddMachineDialog'
import ClientGroup from '../components/ClientGroup'
import Header from '../components/Header'
import MachineDetailDialog from '../components/MachineDetailDialog'
import MachineFormDialog from '../components/MachineFormDialog'
import Toast from '../components/Toast'
import { useMachines } from '../hooks/useMachines'
import { useToast } from '../hooks/useToast'
import { deleteMachine } from '../services/api'
import { useAuth } from '../context/AuthContext'
import type { Machine } from '../types'

const UNASSIGNED = 'Unassigned'

function claudePrompt(m: Machine): string {
  return `Helpdesk: client ${m.client}, machine ${m.host} (${m.ip ?? '?'}, user ${m.sshUser}). ` +
         'Start the session as described in CLAUDE.md, then ask me what the problem is.'
}

export default function DashboardPage() {
  const { logout } = useAuth()
  const { machines, clients, tailscaleError, error, loading, reload } = useMachines(logout)
  const toast = useToast()
  const [filter, setFilter]     = useState('')
  const [adding, setAdding]     = useState(false)
  const [editing, setEditing]   = useState<Machine | null>(null)
  const [detailHost, setDetailHost] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Grouping and filtering
  // ---------------------------------------------------------------------------

  const groups = useMemo(() => {
    const f = filter.trim().toLowerCase()
    const visible = machines.filter((m) =>
      !f || m.host.toLowerCase().includes(f) || (m.client ?? '').toLowerCase().includes(f))
    const map = new Map<string, Machine[]>()
    for (const m of visible) {
      const name = m.client ?? UNASSIGNED
      map.set(name, [...(map.get(name) ?? []), m])
    }
    return [...map.entries()]
  }, [machines, filter])

  const onlineCount = machines.filter((m) => m.online).length

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

  return (
    <>
      <Header>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {loading ? 'loading…' : `${clients.length} clients · ${machines.length} machines · ${onlineCount} online`}
        </div>
        <div className="flex-1" />
        <input className="input w-full sm:w-56" type="search" placeholder="Filter client or machine"
               value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button className="btn-primary" onClick={() => setAdding(true)}>+ Add machine</button>
      </Header>

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        {(error || tailscaleError) && (
          <div className="mb-5 text-center text-sm text-warn dark:text-warn-dark">{error ?? tailscaleError}</div>
        )}
        {!loading && groups.length === 0 && (
          <div className="py-8 text-center text-slate-500">No machines. Use "Add machine" to get started.</div>
        )}
        {groups.map(([name, list]) => (
          <ClientGroup key={name} name={name} unassigned={name === UNASSIGNED} machines={list}
                       onConfigure={setEditing} onRemove={remove} onCopy={copy}
                       onHistory={(m) => setDetailHost(m.host)} />
        ))}
      </main>

      <AddMachineDialog open={adding} onClose={() => setAdding(false)} />
      <MachineDetailDialog host={detailHost} onClose={() => setDetailHost(null)} />
      <MachineFormDialog machine={editing} clients={clients} onClose={() => setEditing(null)} onSaved={saved} />
      <Toast message={toast.message} />
    </>
  )
}
