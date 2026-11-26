import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

interface RefreshStatusProps {
  updatedAt : Date | null
  refreshing: boolean
  onRefresh : () => void
}

function ago(date: Date): string {
  const s = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s} s ago`
  return `${Math.round(s / 60)} min ago`
}

/** "Updated 12 s ago" with a refresh button; the label ticks on its own. */
export default function RefreshStatus({ updatedAt, refreshing, onRefresh }: RefreshStatusProps) {
  const [, tick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 5_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex items-center gap-1.5 text-[13px] text-slate-500 dark:text-slate-400">
      <span>{updatedAt ? `Updated ${ago(updatedAt)}` : ''}</span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label="Refresh now"
        title="Refresh now (refreshes on its own every 30 seconds)"
        className="rounded-md p-1.5 hover:bg-slate-900/5 disabled:opacity-60 dark:hover:bg-white/5"
      >
        <RefreshCw size={15} aria-hidden="true" className={refreshing ? 'animate-spin' : ''} />
      </button>
    </div>
  )
}
