import { KeyRound, Plus, Trash2 } from 'lucide-react'
import { FormEvent, useCallback, useEffect, useState } from 'react'

import { useI18n } from '../i18n'
import { addKey, listKeys, removeKey } from '../services/api'
import type { PublicKey } from '../types'
import Dialog from './Dialog'
import { ListSkeleton } from './Feedback'

// ---------------------------------------------------------------------------
// Admins: the team's SSH public keys (public-keys/*.pub on the server).
// New installers include them; "nodehub keys sync" applies the list to existing client PCs.
// ---------------------------------------------------------------------------

export default function SshKeys({ onMessage }: { onMessage: (text: string) => void }) {
  const { t } = useI18n()
  const [keys, setKeys]     = useState<PublicKey[] | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const reload = useCallback(() => {
    listKeys().then((k) => { setKeys(k); setError(null) }).catch((e: Error) => setError(e.message))
  }, [])

  useEffect(() => { reload() }, [reload])

  async function remove(k: PublicKey) {
    if (!confirm(t.keys.removeConfirm(k.name))) return
    try {
      await removeKey(k.id)
      onMessage(t.keys.removed(k.name))
      reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="card mb-5 p-5" aria-labelledby="keys-title">
      <div className="mb-3 flex items-center gap-2">
        <h2 id="keys-title" className="flex flex-1 items-center gap-2 font-semibold">
          <KeyRound size={16} aria-hidden="true" className="text-slate-400" />{t.keys.title}
        </h2>
        <button className="btn gap-1.5" onClick={() => setAdding(true)}><Plus size={15} aria-hidden="true" />{t.keys.add}</button>
      </div>
      <p className="mb-3 max-w-2xl text-[13px] text-slate-500 dark:text-slate-400">{t.keys.help}</p>

      {error && <p role="alert" className="mb-2 text-sm text-danger dark:text-danger-dark">{error}</p>}
      {!keys && !error && <ListSkeleton rows={2} label={t.keys.loading} />}
      {keys?.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500 dark:border-slate-700">{t.keys.none}</p>
      )}
      {keys && keys.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700/60">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{k.name}{k.comment && <span className="font-normal text-slate-500 dark:text-slate-400"> · {k.comment}</span>}</div>
                <div className="truncate font-mono text-[12px] text-slate-500 dark:text-slate-400" title={k.key}>{k.type} {k.fingerprint}</div>
              </div>
              <button className="btn gap-1.5 text-danger dark:text-danger-dark" onClick={() => remove(k)} aria-label={t.keys.removeLabel(k.name)}>
                <Trash2 size={14} aria-hidden="true" /><span className="hidden sm:inline">{t.common.remove}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 rounded-lg bg-surface px-3 py-2.5 text-[13px] dark:bg-surface-dark">{t.keys.syncHint}</div>

      <AddKeyDialog open={adding} onClose={() => setAdding(false)}
                    onAdded={(name) => { setAdding(false); onMessage(t.keys.added(name)); reload() }} />
    </section>
  )
}

function AddKeyDialog({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (name: string) => void }) {
  const { t } = useI18n()
  const [name, setName]   = useState('')
  const [key, setKey]     = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) { setName(''); setKey(''); setError(null) }
  }, [open])

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      const added = await addKey(name.trim(), key.trim())
      onAdded(added.name)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const label = 'mb-1 block text-[13px] text-slate-500 dark:text-slate-400'

  return (
    <Dialog open={open} title={t.keys.addTitle} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className={label}>{t.keys.name}</span>
          <input className="input" required maxLength={40} pattern="[A-Za-z0-9._\-]+" placeholder={t.keys.namePlaceholder}
                 value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className={label}>{t.keys.publicKey}</span>
          <textarea className="input min-h-[96px] font-mono text-[12px]" required placeholder="ssh-ed25519 AAAAC3Nza... pedro@PC-PEDRO"
                    value={key} onChange={(e) => setKey(e.target.value)} />
          <span className="mt-1 block text-[12px] text-slate-500 dark:text-slate-400">{t.keys.publicKeyHelp}</span>
        </label>
        <div role="alert" className="min-h-5 text-sm text-danger dark:text-danger-dark">{error}</div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>{t.common.cancel}</button>
          <button type="submit" className="btn-primary">{t.keys.add}</button>
        </div>
      </form>
    </Dialog>
  )
}
