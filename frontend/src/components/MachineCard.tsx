import { Copy, History, MonitorCog, MoreHorizontal, Network, Pencil, Settings2, Terminal, Trash2, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router'

import { useI18n } from '../i18n'
import type { Machine } from '../types'
import { launcherLink, machinePath } from '../utils/machine'
import { fullDate, timeAgo } from '../utils/time'
import Menu from './Menu'

interface MachineCardProps {
  machine    : Machine
  onConfigure: (m: Machine) => void
  onRemove   : (m: Machine) => void
  onCopy     : (m: Machine) => void
}

/** Status line next to the dot: online / offline since / missing from the tailnet. */
function Status({ m }: { m: Machine }) {
  const { t } = useI18n()
  if (m.online) return <span className="font-medium text-online dark:text-online-dark">{t.common.online}</span>
  if (!m.inTailnet) return <span className="text-warn dark:text-warn-dark">{t.card.notInTailnet}</span>
  return (
    <span title={m.lastSeen ? t.card.lastSeen(fullDate(m.lastSeen)) : undefined}>
      {t.common.offline}{m.lastSeen && ` · ${t.card.seen(timeAgo(m.lastSeen))}`}
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

export default function MachineCard({ machine: m, onConfigure, onRemove, onCopy }: MachineCardProps) {
  const navigate = useNavigate()
  const { t } = useI18n()

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
        <h3 className="min-w-0 flex-1 truncate text-base font-semibold" title={m.host}>
          {m.configured
            ? <Link to={machinePath(m.host)} className="hover:text-brand hover:underline dark:hover:text-brand-dark">{m.host}</Link>
            : m.host}
        </h3>

        {m.configured && (
          <Menu
            label={t.card.moreActions(m.host)}
            trigger={<MoreHorizontal size={18} />}
            triggerClass="rounded-md p-1 text-slate-500 opacity-70 transition hover:bg-surface hover:opacity-100
                          group-hover:opacity-100 dark:hover:bg-surface-dark"
            items={[
              { label: t.card.historyProfile, icon: <History size={16} />, onClick: () => navigate(machinePath(m.host)) },
              { label: t.common.edit, icon: <Pencil size={16} />, onClick: () => onConfigure(m) },
              'separator',
              { label: t.common.remove, icon: <Trash2 size={16} />, onClick: () => onRemove(m), danger: true },
            ]}
          />
        )}
      </div>

      <div className="text-[13px] text-slate-500 dark:text-slate-400"><Status m={m} /></div>

      <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[13px] text-slate-500 dark:text-slate-400">
        {m.ip && <Detail icon={<Network size={13} />} title={t.card.ip}>{m.ip}</Detail>}
        {m.sshUser && <Detail icon={<UserRound size={13} />} title={t.card.sshUser}>{m.sshUser}</Detail>}
        {m.os && <Detail icon={<MonitorCog size={13} />} title={t.card.os}>{m.os}</Detail>}
        {m.configured && (
          <Detail icon={<History size={13} />} title={m.lastSessionAt ? t.card.lastSession(fullDate(m.lastSessionAt)) : undefined}>
            {m.lastSessionAt ? t.card.session(timeAgo(m.lastSessionAt)) : t.card.noSessions}
          </Detail>
        )}
      </div>

      {m.notes && <p className="line-clamp-2 text-[13px] italic text-slate-500 dark:text-slate-400">{m.notes}</p>}

      <div className="mt-auto flex gap-2 pt-1">
        {m.configured ? (
          <>
            <a className="btn-primary flex-1 gap-1.5" href={launcherLink(m)}>
              <Terminal size={15} aria-hidden="true" />{t.common.openInClaude}
            </a>
            <button className="btn gap-1.5" onClick={() => onCopy(m)} title={t.card.copyTitle}>
              <Copy size={15} aria-hidden="true" />{t.common.copy}
            </button>
          </>
        ) : (
          <button className="btn-primary flex-1 gap-1.5" onClick={() => onConfigure(m)}>
            <Settings2 size={15} aria-hidden="true" />{t.common.configure}
          </button>
        )}
      </div>
    </article>
  )
}
