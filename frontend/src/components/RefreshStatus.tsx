import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Messages, useI18n } from '../i18n'

interface RefreshStatusProps {
  updatedAt : Date | null
  refreshing: boolean
  onRefresh : () => void
}

function ago(date: Date, t: Messages['refresh']): string {
  const s = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000))
  if (s < 5) return t.justNow
  if (s < 60) return t.seconds(s)
  return t.minutes(Math.round(s / 60))
}

/** "Updated 12 s ago" with a refresh button; the label ticks on its own. */
export default function RefreshStatus({ updatedAt, refreshing, onRefresh }: RefreshStatusProps) {
  const { t } = useI18n()
  const [, tick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 5_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex items-center gap-1.5 text-[13px] text-slate-500 dark:text-slate-400">
      <span>{updatedAt ? t.refresh.updated(ago(updatedAt, t.refresh)) : ''}</span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label={t.refresh.now}
        title={t.refresh.title}
        className="rounded-md p-1.5 hover:bg-slate-900/5 disabled:opacity-60 dark:hover:bg-white/5"
      >
        <RefreshCw size={15} aria-hidden="true" className={refreshing ? 'animate-spin' : ''} />
      </button>
    </div>
  )
}
