import { useCallback, useEffect, useState } from 'react'

import { useI18n } from '../i18n'
import { listTokens, revokeToken } from '../services/api'
import type { AccessToken } from '../types'
import { formatDate, timeAgo } from '../utils/time'
import Dialog from './Dialog'
import { ListSkeleton } from './Feedback'

interface ConnectedPcsDialogProps {
  open   : boolean
  onClose: () => void
}

/** PCs where the nodehub CLI (used by Claude Code) is connected with your account. */
export default function ConnectedPcsDialog({ open, onClose }: ConnectedPcsDialogProps) {
  const { t } = useI18n()
  const [pcs, setPcs]         = useState<AccessToken[]>([])
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    setLoading(true)
    listTokens()
      .then(setPcs)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!open) return
    setError(null)
    reload()
  }, [open, reload])

  async function disconnect(pc: AccessToken) {
    if (!confirm(t.pcs.confirm(pc.name))) return
    try {
      await revokeToken(pc.id)
      reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Dialog open={open} title={t.pcs.title} onClose={onClose}>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">{t.pcs.intro}</p>

      {error && <div className="mb-3 text-sm text-danger dark:text-danger-dark">{error}</div>}

      <ul className="space-y-2">
        {loading && pcs.length === 0 && <li><ListSkeleton rows={2} label={t.pcs.loading} /></li>}
        {!loading && pcs.length === 0 && (
          <li className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500 dark:border-slate-700">
            {t.pcs.none}
          </li>
        )}
        {pcs.map((pc) => (
          <li key={pc.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700/60">
            <div className="flex-1">
              <div className="font-medium">{pc.name}</div>
              <div className="text-[13px] text-slate-500 dark:text-slate-400">
                {t.pcs.connected(formatDate(pc.createdAt))}
                {' · '}{pc.lastUsedAt ? t.pcs.lastUsed(timeAgo(pc.lastUsedAt)) : t.pcs.neverUsed}
              </div>
            </div>
            <button className="btn text-danger dark:text-danger-dark" onClick={() => disconnect(pc)}>{t.pcs.disconnect}</button>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex justify-end">
        <button className="btn" onClick={onClose}>{t.common.close}</button>
      </div>
    </Dialog>
  )
}
