import { FormEvent, useCallback, useEffect, useState } from 'react'

import { createToken, listTokens, revokeToken } from '../services/api'
import type { AccessToken } from '../types'
import Dialog from './Dialog'

interface TokensDialogProps {
  open   : boolean
  onClose: () => void
}

/** Personal access tokens for the nodehub CLI, which Claude Code uses to read and record history. */
export default function TokensDialog({ open, onClose }: TokensDialogProps) {
  const [tokens, setTokens]   = useState<AccessToken[]>([])
  const [name, setName]       = useState('')
  const [created, setCreated] = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)

  const reload = useCallback(() => {
    listTokens().then(setTokens).catch((e: Error) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!open) return
    setName(''); setCreated(null); setError(null)
    reload()
  }, [open, reload])

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      const t = await createToken(name.trim())
      setCreated(t.token)
      setName('')
      reload()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function revoke(t: AccessToken) {
    if (!confirm(`Revoke "${t.name}"? Anything using it (the nodehub CLI on that PC) stops working.`)) return
    await revokeToken(t.id).catch((e: Error) => setError(e.message))
    reload()
  }

  return (
    <Dialog open={open} title="Access tokens" onClose={onClose}>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Claude Code uses the <code>nodehub</code> CLI to read each machine's history and record sessions under your
        name. Create one token per PC, then run <code>.\nodehub.cmd login</code> in the nodehub folder and paste it.
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

      <form onSubmit={submit} className="mb-4 flex gap-2">
        <input className="input" required maxLength={60} placeholder="Token name, e.g. Office laptop"
               value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn-primary whitespace-nowrap">Create token</button>
      </form>

      {error && <div className="mb-3 text-sm text-danger dark:text-danger-dark">{error}</div>}

      <ul className="space-y-2">
        {tokens.length === 0 && <li className="text-sm text-slate-500">No tokens yet.</li>}
        {tokens.map((t) => (
          <li key={t.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700/60">
            <div className="flex-1">
              <div className="font-medium">{t.name}</div>
              <div className="text-[13px] text-slate-500 dark:text-slate-400">
                <code>{t.prefix}…</code> · created {new Date(t.createdAt).toLocaleDateString()}
                {' · '}{t.lastUsedAt ? `last used ${new Date(t.lastUsedAt).toLocaleString()}` : 'never used'}
              </div>
            </div>
            <button className="btn text-danger dark:text-danger-dark" onClick={() => revoke(t)}>Revoke</button>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex justify-end">
        <button className="btn" onClick={onClose}>Close</button>
      </div>
    </Dialog>
  )
}
