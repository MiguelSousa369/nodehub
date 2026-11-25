import { useCallback, useEffect, useState } from 'react'

import { generateToken, getToken, revokeToken } from '../services/api'
import type { AccessToken } from '../types'
import Dialog from './Dialog'

interface AccessTokenDialogProps {
  open   : boolean
  onClose: () => void
}

/** Your personal access token for the nodehub CLI, which Claude Code uses to read and record history. */
export default function AccessTokenDialog({ open, onClose }: AccessTokenDialogProps) {
  const [token, setToken]     = useState<AccessToken | null>(null)
  const [created, setCreated] = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    setLoading(true)
    getToken()
      .then(setToken)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!open) return
    setCreated(null); setError(null)
    reload()
  }, [open, reload])

  async function generate() {
    if (token && !confirm('Generate a new token?\n\nThe current one stops working on every PC that uses it. ' +
                          'Run ".\\nodehub.cmd login" again on those PCs with the new token.')) return
    try {
      const t = await generateToken()
      setCreated(t.token)
      setToken(t)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function revoke() {
    if (!confirm('Revoke your token?\n\nThe nodehub CLI stops working on every PC that uses it.')) return
    try {
      await revokeToken()
      setCreated(null)
      reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Dialog open={open} title="Access token" onClose={onClose}>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Claude Code uses the <code>nodehub</code> CLI to read each machine's history and record sessions under your
        name. Generate your token, then run <code>.\nodehub.cmd login</code> in the nodehub folder on each PC you work
        from and paste it.
      </p>

      {created && (
        <div className="mb-4 rounded-lg border border-online/40 bg-online/10 p-3 text-sm">
          <div className="mb-1 font-medium">Copy it now: it won't be shown again.</div>
          <div className="flex gap-2">
            <code className="flex-1 break-all rounded bg-surface px-2 py-1 dark:bg-surface-dark">{created}</code>
            <button className="btn" onClick={() => navigator.clipboard.writeText(created)}>Copy</button>
          </div>
        </div>
      )}

      {error && <div className="mb-3 text-sm text-danger dark:text-danger-dark">{error}</div>}

      {!loading && (
        <div className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700/60">
          {token ? (
            <>
              <div className="font-medium"><code>{token.prefix}…</code></div>
              <div className="text-[13px] text-slate-500 dark:text-slate-400">
                Generated {new Date(token.createdAt).toLocaleString()}
                {' · '}{token.lastUsedAt ? `last used ${new Date(token.lastUsedAt).toLocaleString()}` : 'never used'}
              </div>
            </>
          ) : (
            <div className="text-slate-500">You don't have a token yet.</div>
          )}
        </div>
      )}

      <div className="mt-5 flex gap-2">
        {token && <button className="btn text-danger dark:text-danger-dark" onClick={revoke}>Revoke</button>}
        <span className="flex-1" />
        <button className="btn" onClick={onClose}>Close</button>
        <button className="btn-primary" onClick={generate}>{token ? 'Generate new token' : 'Generate token'}</button>
      </div>
    </Dialog>
  )
}
