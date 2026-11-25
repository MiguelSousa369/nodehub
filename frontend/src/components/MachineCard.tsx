import { useEffect, useRef, useState } from 'react'

import type { Machine } from '../types'

interface MachineCardProps {
  machine    : Machine
  onConfigure: (m: Machine) => void
  onRemove   : (m: Machine) => void
  onCopy     : (m: Machine) => void
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

export default function MachineCard({ machine: m, onConfigure, onRemove, onCopy }: MachineCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close the ⋯ menu when clicking outside it
  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  const details = [statusText(m), m.ip, m.sshUser].filter(Boolean).join(' · ')

  return (
    <div className={`card flex flex-col gap-1.5 px-4 py-3.5 ${m.configured ? '' : 'border-dashed !border-warn dark:!border-warn-dark'}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 flex-none rounded-full ${m.online
          ? 'bg-online shadow-[0_0_0_3px_rgb(31_157_85/0.25)] dark:bg-online-dark'
          : 'bg-slate-400 dark:bg-slate-600'}`} />
        <span className="flex-1 truncate text-base font-semibold">{m.host}</span>

        {m.configured && (
          <div ref={menuRef} className="relative">
            <button
              aria-label="More actions"
              onClick={() => setMenuOpen((o) => !o)}
              className="rounded-md px-2 text-lg leading-tight text-slate-500 hover:bg-surface dark:hover:bg-surface-dark"
            >⋯</button>
            {menuOpen && (
              <div className="card absolute right-0 top-7 z-10 min-w-[130px] p-1 shadow-xl">
                <button className="block w-full rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-surface dark:hover:bg-surface-dark"
                        onClick={() => { setMenuOpen(false); onConfigure(m) }}>Edit</button>
                <button className="block w-full rounded-md px-2.5 py-1.5 text-left text-sm text-danger hover:bg-surface dark:text-danger-dark dark:hover:bg-surface-dark"
                        onClick={() => { setMenuOpen(false); onRemove(m) }}>Remove</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="text-[13px] text-slate-500 dark:text-slate-400">{details}</div>
      {m.notes && <div className="text-[13px] text-slate-500 dark:text-slate-400">{m.notes}</div>}

      <div className="mt-1.5 flex gap-2">
        {m.configured ? (
          <>
            <a className="btn-primary flex-1" href={launcherLink(m)}>Open in Claude</a>
            <button className="btn flex-1" onClick={() => onCopy(m)}>Copy</button>
          </>
        ) : (
          <button className="btn-primary flex-1" onClick={() => onConfigure(m)}>Configure</button>
        )}
      </div>
    </div>
  )
}
