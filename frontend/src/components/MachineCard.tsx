import { Copy, History, MonitorCog, MoreHorizontal, Network, Pencil, Settings2, Terminal, Trash2, UserRound } from 'lucide-react'

import type { Machine } from '../types'
import { fullDate, timeAgo } from '../utils/time'
import Menu from './Menu'

interface MachineCardProps {
  machine    : Machine
  onConfigure: (m: Machine) => void
  onRemove   : (m: Machine) => void
  onCopy     : (m: Machine) => void
  onHistory  : (m: Machine) => void
}

/** nodehub:// link handled by launcher/open.ps1 (which re-checks the host against Tailscale). */
function launcherLink(m: Machine): string {
  const params = new URLSearchParams({ host: m.host, client: m.client ?? '', user: m.sshUser ?? '' })
  return `nodehub://open?${params.toString().replace(/\+/g, '%20')}`
}

/** Status line next to the dot: online / offline since / missing from the tailnet. */
function Status({ m }: { m: Machine }) {
  if (m.online) return <span className="font-medium text-online dark:text-online-dark">Online</span>
  if (!m.inTailnet) return <span className="text-warn dark:text-warn-dark">Not found in the tailnet</span>
  return (
    <span title={m.lastSeen ? `Last seen ${fullDate(m.lastSeen)}` : undefined}>
      Offline{m.lastSeen && ` · seen ${timeAgo(m.lastSeen)}`}
    </span>
  )
}

/** Small icon + text pair in the card's details row. */
function Detail({ icon, children, title }: { icon: React.ReactNode; children: React.ReactNode; title?: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1" title={title}>
      <span className="flex-none text-slate-400 dark:text-slate-500" aria-hidden="true">{icon}</span>
      <span className="truncate">{children}</span>
    </span>
  )
}

// ---------------------------------------------------------------------------
// One machine: status, details, and the actions to start a helpdesk session.
// Unassigned machines (in the tailnet, not configured yet) get a dashed border and a Configure button.
// ---------------------------------------------------------------------------

export default function MachineCard({ machine: m, onConfigure, onRemove, onCopy, onHistory }: MachineCardProps) {
  return (
    <article
      aria-label={m.host}
      className={`card group flex flex-col gap-2 px-4 py-3.5 transition hover:-translate-y-px hover:shadow-lg
                  hover:shadow-slate-900/5 dark:hover:shadow-black/30
                  ${m.configured ? '' : 'border-dashed !border-warn dark:!border-warn-dark'}`}
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className={`h-2.5 w-2.5 flex-none rounded-full ${m.online
            ? 'beat bg-online dark:bg-online-dark'
            : 'bg-slate-300 dark:bg-slate-600'}`}
        />
        <h3 className="min-w-0 flex-1 truncate text-base font-semibold" title={m.host}>{m.host}</h3>

        {m.configured && (
          <Menu
            label={`More actions for ${m.host}`}
            trigger={<MoreHorizontal size={18} />}
            triggerClass="rounded-md p-1 text-slate-500 opacity-70 transition hover:bg-surface hover:opacity-100
                          group-hover:opacity-100 dark:hover:bg-surface-dark"
            items={[
              { label: 'History & profile', icon: <History size={16} />, onClick: () => onHistory(m) },
              { label: 'Edit', icon: <Pencil size={16} />, onClick: () => onConfigure(m) },
              'separator',
              { label: 'Remove', icon: <Trash2 size={16} />, onClick: () => onRemove(m), danger: true },
            ]}
          />
        )}
      </div>

      <div className="text-[13px] text-slate-500 dark:text-slate-400"><Status m={m} /></div>

      <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[13px] text-slate-500 dark:text-slate-400">
        {m.ip && <Detail icon={<Network size={13} />} title="Tailscale IP">{m.ip}</Detail>}
        {m.sshUser && <Detail icon={<UserRound size={13} />} title="SSH user">{m.sshUser}</Detail>}
        {m.os && <Detail icon={<MonitorCog size={13} />} title="Operating system">{m.os}</Detail>}
        {m.configured && (
          <Detail icon={<History size={13} />} title={m.lastSessionAt ? `Last session ${fullDate(m.lastSessionAt)}` : undefined}>
            {m.lastSessionAt ? `session ${timeAgo(m.lastSessionAt)}` : 'no sessions yet'}
          </Detail>
        )}
      </div>

      {m.notes && <p className="line-clamp-2 text-[13px] italic text-slate-500 dark:text-slate-400">{m.notes}</p>}

      <div className="mt-auto flex gap-2 pt-1">
        {m.configured ? (
          <>
            <a className="btn-primary flex-1 gap-1.5" href={launcherLink(m)}>
              <Terminal size={15} aria-hidden="true" />Open in Claude
            </a>
            <button className="btn gap-1.5" onClick={() => onCopy(m)} title="Copy a prompt to paste into Claude Code">
              <Copy size={15} aria-hidden="true" />Copy
            </button>
          </>
        ) : (
          <button className="btn-primary flex-1 gap-1.5" onClick={() => onConfigure(m)}>
            <Settings2 size={15} aria-hidden="true" />Configure
          </button>
        )}
      </div>
    </article>
  )
}
