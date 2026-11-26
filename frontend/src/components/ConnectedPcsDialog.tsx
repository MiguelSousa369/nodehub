import { useCallback, useEffect, useState } from 'react'

import { listTokens, revokeToken } from '../services/api'
import type { AccessToken } from '../types'
import { timeAgo } from '../utils/time'
import Dialog from './Dialog'

interface ConnectedPcsDialogProps {
  open   : boolean
  onClose: () => void
}

/** PCs where the nodehub CLI (used by Claude Code) is connected with your account. */
export default function ConnectedPcsDialog({ open, onClose }: ConnectedPcsDialogProps) {
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
    if (!confirm(`Disconnect ${pc.name}?\n\nClaude on that PC can no longer read or record history until it connects again.`)) return
    try {
      await revokeToken(pc.id)
      reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Dialog open={open} title="Connected PCs" onClose={onClose}>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        PCs where Claude Code can read machine history and record sessions in your name. A PC connects the first time
        you click <b>Open in Claude</b> on it (or with <code>.\nodehub.cmd login</code>): you approve it in the browser.
      </p>

      {error && <div className="mb-3 text-sm text-danger dark:text-danger-dark">{error}</div>}

      <ul className="space-y-2">
        {!loading && pcs.length === 0 && <li className="text-sm text-slate-500">No PCs connected yet.</li>}
        {pcs.map((pc) => (
          <li key={pc.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700/60">
            <div className="flex-1">
              <div className="font-medium">{pc.name}</div>
              <div className="text-[13px] text-slate-500 dark:text-slate-400">
                Connected {new Date(pc.createdAt).toLocaleDateString()}
                {' · '}{pc.lastUsedAt ? `last used ${timeAgo(pc.lastUsedAt)}` : 'never used'}
              </div>
            </div>
            <button className="btn text-danger dark:text-danger-dark" onClick={() => disconnect(pc)}>Disconnect</button>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex justify-end">
        <button className="btn" onClick={onClose}>Close</button>
      </div>
    </Dialog>
  )
}
