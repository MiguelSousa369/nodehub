import { Copy, History, Pencil, Settings2, Terminal, Trash2, MoreHorizontal } from 'lucide-react'

import type { Machine } from '../types'
import Menu from './Menu'

interface MachineCardProps {
  machine    : Machine
  onConfigure: (m: Machine) => void
  onRemove   : (m: Machine) => void
  onCopy     : (m: Machine) => void
  onHistory  : (m: Machine) => void
}

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 60) return `${min} min ago`
  if (min < 1440) return `${Math.round(min / 60)} h ago`
  return `${Math.round(min / 1440)} days ago`
}

/** nodehub:// link handled by launcher/open.ps1 (which re-checks the host against Tailscale). */
function launcherLink(m: Machine): string {
  const params = new URLSearchParams({ host: m.host, client: m.client ?? '', user: m.sshUser ?? '' })
  return `nodehub://open?${params.toString().replace(/\+/g, '%20')}`
}

function statusText(m: Machine): string {
  if (m.online) return 'online'
  if (m.inTailnet) return `offline ${timeAgo(m.lastSeen)}`.trim()
  return 'not found in the tailnet'
}

export default function MachineCard({ machine: m, onConfigure, onRemove, onCopy, onHistory }: MachineCardProps) {
  const details = [statusText(m), m.ip, m.sshUser].filter(Boolean).join(' · ')

  return (
    <div className={`card flex flex-col gap-1.5 px-4 py-3.5 ${m.configured ? '' : 'border-dashed !border-warn dark:!border-warn-dark'}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 flex-none rounded-full ${m.online
          ? 'bg-online shadow-[0_0_0_3px_rgb(31_157_85/0.25)] dark:bg-online-dark'
          : 'bg-slate-400 dark:bg-slate-600'}`} />
        <span className="flex-1 truncate text-base font-semibold">{m.host}</span>

        {m.configured && (
          <Menu
            label={`More actions for ${m.host}`}
            trigger={<MoreHorizontal size={18} />}
            triggerClass="rounded-md p-1 text-slate-500 hover:bg-surface dark:hover:bg-surface-dark"
            items={[
              { label: 'History & profile', icon: <History size={16} />, onClick: () => onHistory(m) },
              { label: 'Edit', icon: <Pencil size={16} />, onClick: () => onConfigure(m) },
              'separator',
              { label: 'Remove', icon: <Trash2 size={16} />, onClick: () => onRemove(m), danger: true },
            ]}
          />
        )}
      </div>

      <div className="text-[13px] text-slate-500 dark:text-slate-400">{details}</div>
      {m.notes && <div className="text-[13px] text-slate-500 dark:text-slate-400">{m.notes}</div>}

      <div className="mt-1.5 flex gap-2">
        {m.configured ? (
          <>
            <a className="btn-primary flex-1 gap-1.5" href={launcherLink(m)}><Terminal size={15} aria-hidden="true" />Open in Claude</a>
            <button className="btn gap-1.5" onClick={() => onCopy(m)} title="Copy a prompt to paste into Claude Code">
              <Copy size={15} aria-hidden="true" />Copy
            </button>
          </>
        ) : (
          <button className="btn-primary flex-1 gap-1.5" onClick={() => onConfigure(m)}><Settings2 size={15} aria-hidden="true" />Configure</button>
        )}
      </div>
    </div>
  )
}
