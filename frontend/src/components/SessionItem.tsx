import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'

import type { Session, SessionResult } from '../types'
import { machinePath } from '../utils/machine'
import { formatDateTime, formatTime, fullDate } from '../utils/time'

const RESULT_STYLE: Record<SessionResult, { label: string; className: string }> = {
  FIXED     : { label: 'Fixed',      className: 'bg-online/15 text-online dark:text-online-dark' },
  PARTIAL   : { label: 'Partial',    className: 'bg-warn/15 text-warn dark:text-warn-dark' },
  UNRESOLVED: { label: 'Unresolved', className: 'bg-danger/15 text-danger dark:text-danger-dark' },
}

export function ResultBadge({ result }: { result: SessionResult }) {
  const style = RESULT_STYLE[result]
  return <span className={`flex-none rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}>{style.label}</span>
}

interface SessionItemProps {
  session  : Session
  showHost?: boolean   // in the global history, show which machine/client it was
  timeOnly?: boolean   // the list is already grouped by day: show just the time
}

// ---------------------------------------------------------------------------
// One helpdesk session: a summary line that opens in place to show the details.
// Built on <details>, so it works with the keyboard and screen readers without extra code.
// ---------------------------------------------------------------------------

export default function SessionItem({ session: s, showHost = false, timeOnly = false }: SessionItemProps) {
  const fields = [['Problem', s.problem], ['Diagnosis', s.diagnosis], ['Actions', s.actions], ['Pending', s.pending]]
    .filter(([, value]) => value)
  const when = timeOnly ? formatTime(s.createdAt) : formatDateTime(s.createdAt)

  return (
    <details className="card group px-3.5 py-2.5 open:shadow-md open:shadow-slate-900/5 dark:open:shadow-black/20">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded outline-none
                          focus-visible:ring-2 focus-visible:ring-brand/50 [&::-webkit-details-marker]:hidden">
        <ChevronRight size={15} aria-hidden="true" className="flex-none text-slate-400 transition-transform group-open:rotate-90" />
        <ResultBadge result={s.result} />
        <span className="min-w-0 flex-1 font-medium">{s.summary}</span>
        <span className="text-[13px] text-slate-500 dark:text-slate-400">
          {showHost && (
            <>
              <Link to={machinePath(s.host)} className="font-medium text-slate-700 hover:underline dark:text-slate-300"
                    onClick={(e) => e.stopPropagation()}>{s.host}</Link>
              {s.client ? ` (${s.client})` : ''} ·{' '}
            </>
          )}
          {s.technician?.name ?? 'deleted user'} · <time dateTime={s.createdAt} title={fullDate(s.createdAt)}>{when}</time>
        </span>
      </summary>
      {fields.length > 0 ? (
        <dl className="mt-2.5 grid gap-x-4 gap-y-2 border-t border-slate-100 pl-6 pt-2.5 text-sm sm:grid-cols-[110px_1fr] dark:border-slate-800">
          {fields.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-[13px] text-slate-500 dark:text-slate-400">{label}</dt>
              <dd className="whitespace-pre-wrap">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 border-t border-slate-100 pl-6 pt-2 text-sm text-slate-500 dark:border-slate-800">No details recorded.</p>
      )}
    </details>
  )
}
