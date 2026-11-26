import { Link } from 'react-router'

import type { Session, SessionResult } from '../types'
import { machinePath } from '../utils/machine'

const RESULT_STYLE: Record<SessionResult, { label: string; className: string }> = {
  FIXED     : { label: 'Fixed',      className: 'bg-online/15 text-online dark:text-online-dark' },
  PARTIAL   : { label: 'Partial',    className: 'bg-warn/15 text-warn dark:text-warn-dark' },
  UNRESOLVED: { label: 'Unresolved', className: 'bg-danger/15 text-danger dark:text-danger-dark' },
}

export function ResultBadge({ result }: { result: SessionResult }) {
  const style = RESULT_STYLE[result]
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}>{style.label}</span>
}

interface SessionItemProps {
  session : Session
  showHost?: boolean   // in the global history, show which machine/client it was
}

/** One helpdesk session: summary line, then the details. */
export default function SessionItem({ session: s, showHost = false }: SessionItemProps) {
  const fields = [['Problem', s.problem], ['Diagnosis', s.diagnosis], ['Actions', s.actions], ['Pending', s.pending]]
    .filter(([, value]) => value)

  return (
    <details className="group rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700/60">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1">
        <ResultBadge result={s.result} />
        <span className="flex-1 font-medium">{s.summary}</span>
        <span className="text-[13px] text-slate-500 dark:text-slate-400">
          {showHost && (
            <>
              <Link to={machinePath(s.host)} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{s.host}</Link>
              {s.client ? ` (${s.client})` : ''} ·{' '}
            </>
          )}
          {s.technician?.name ?? 'deleted user'} · {new Date(s.createdAt).toLocaleString()}
        </span>
      </summary>
      {fields.length > 0 && (
        <dl className="mt-2 space-y-1.5 border-t border-slate-100 pt-2 text-sm dark:border-slate-800">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="text-[13px] text-slate-500 dark:text-slate-400">{label}</dt>
              <dd className="whitespace-pre-wrap">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </details>
  )
}
