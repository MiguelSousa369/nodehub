import { KeyRound, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { FormEvent, useCallback, useEffect, useState } from 'react'

import { useUser } from '../context/AuthContext'
import { useI18n } from '../i18n'
import { addKey, listKeys, removeKey } from '../services/api'
import type { PublicKey, User } from '../types'
import Dialog from './Dialog'
import { ListSkeleton } from './Feedback'

// ---------------------------------------------------------------------------
// The team's SSH public keys. Each key belongs to an account (or is a service key). New installers
// include the effective keys; "Sync keys" opens a window on this PC (nodehub://keys-sync) that applies
// them to every online client PC after showing what would change.
//
//   <SshKeys mode="admin" users={...} />   Users page: every key, add for anyone or a service key
//   <MySshKeysDialog />                    account menu: your own keys
// ---------------------------------------------------------------------------

const SYNC_LINK = 'nodehub://keys-sync'

/** Opens the sync window on this PC (it previews the changes and asks before applying). */
function SyncButton() {
  const { t } = useI18n()
  return (
    <a className="btn gap-1.5" href={SYNC_LINK} title={t.keys.syncTitle}>
      <RefreshCw size={15} aria-hidden="true" />{t.keys.sync}
    </a>
  )
}

function useKeys() {
  const [keys, setKeys]   = useState<PublicKey[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(() => {
    listKeys().then((k) => { setKeys(k); setError(null) }).catch((e: Error) => setError(e.message))
  }, [])
  useEffect(() => { reload() }, [reload])
  return { keys, error, setError, reload }
}

/** Rows of keys, with owner (admin view) and a Remove button. */
function KeyRows({ keys, showOwner, onRemove }: { keys: PublicKey[]; showOwner: boolean; onRemove: (k: PublicKey) => void }) {
  const { t } = useI18n()
  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700/60">
      {keys.map((k) => (
        <li key={k.id} className={`flex items-center gap-3 px-3 py-2 text-sm ${k.effective ? '' : 'opacity-60'}`}>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 font-medium">
              {showOwner && <span>{k.owner ? k.owner.name : t.keys.service}</span>}
              <span className={showOwner ? 'font-normal text-slate-500 dark:text-slate-400' : ''}>{showOwner ? `· ${k.name}` : k.name}</span>
              {!k.effective && (
                <span className="rounded-full bg-warn/10 px-2 py-0.5 text-[11px] font-medium text-warn dark:text-warn-dark">{t.keys.inactive}</span>
              )}
            </div>
            <div className="truncate font-mono text-[12px] text-slate-500 dark:text-slate-400" title={k.key}>
              {k.type} {k.fingerprint}{k.comment && ` · ${k.comment}`}
            </div>
          </div>
          <button className="btn gap-1.5 text-danger dark:text-danger-dark" onClick={() => onRemove(k)} aria-label={t.keys.removeLabel(k.name)}>
            <Trash2 size={14} aria-hidden="true" /><span className="hidden sm:inline">{t.common.remove}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Admins, on the Users page: every key. */
export default function SshKeys({ users, onMessage }: { users: User[]; onMessage: (text: string) => void }) {
  const { t } = useI18n()
  const { keys, error, setError, reload } = useKeys()
  const [adding, setAdding] = useState(false)

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
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 id="keys-title" className="flex flex-1 items-center gap-2 font-semibold">
          <KeyRound size={16} aria-hidden="true" className="text-slate-400" />{t.keys.title}
        </h2>
        <SyncButton />
        <button className="btn gap-1.5" onClick={() => setAdding(true)}><Plus size={15} aria-hidden="true" />{t.keys.add}</button>
      </div>
      <p className="mb-3 max-w-2xl text-[13px] text-slate-500 dark:text-slate-400">{t.keys.help}</p>

      {error && <p role="alert" className="mb-2 text-sm text-danger dark:text-danger-dark">{error}</p>}
      {!keys && !error && <ListSkeleton rows={2} label={t.keys.loading} />}
      {keys?.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500 dark:border-slate-700">{t.keys.none}</p>}
      {keys && keys.length > 0 && <KeyRows keys={keys} showOwner onRemove={remove} />}

      <p className="mt-3 text-[13px] text-slate-500 dark:text-slate-400">{t.keys.syncHint}</p>

      <AddKeyDialog open={adding} users={users} onClose={() => setAdding(false)}
                    onAdded={(name) => { setAdding(false); onMessage(t.keys.added(name)); reload() }} />
    </section>
  )
}

/** Account menu: your own keys. */
export function MySshKeysDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const me = useUser()
  const { keys, error, setError, reload } = useKeys()
  const [adding, setAdding]   = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const mine = keys?.filter((k) => k.owner?.id === me.id) ?? null

  useEffect(() => { if (open) { reload(); setMessage(null) } }, [open, reload])

  async function remove(k: PublicKey) {
    if (!confirm(t.keys.removeConfirm(k.name))) return
    try {
      await removeKey(k.id)
      setMessage(t.keys.removed(k.name))
      reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Dialog open={open} title={t.keys.mine} onClose={onClose} wide>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">{t.keys.mineHelp}</p>
      {error && <p role="alert" className="mb-2 text-sm text-danger dark:text-danger-dark">{error}</p>}
      {message && <p role="status" className="mb-2 text-sm text-online dark:text-online-dark">{message}</p>}
      {!mine && !error && <ListSkeleton rows={1} label={t.keys.loading} />}
      {mine?.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500 dark:border-slate-700">{t.keys.mineNone}</p>}
      {mine && mine.length > 0 && <KeyRows keys={mine} showOwner={false} onRemove={remove} />}
      <p className="mt-3 text-[13px] text-slate-500 dark:text-slate-400">{t.keys.syncHint}</p>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <SyncButton />
        <button className="btn gap-1.5" onClick={() => setAdding(true)}><Plus size={15} aria-hidden="true" />{t.keys.add}</button>
        <button className="btn" onClick={onClose}>{t.common.close}</button>
      </div>
      <AddKeyDialog open={adding} onClose={() => setAdding(false)}
                    onAdded={(name) => { setAdding(false); setMessage(t.keys.added(name)); reload() }} />
    </Dialog>
  )
}

/** Paste a .pub file. Admins (users given) also pick the owner, or a service key. */
function AddKeyDialog({ open, users, onClose, onAdded }: {
  open: boolean; users?: User[]; onClose: () => void; onAdded: (name: string) => void
}) {
  const { t } = useI18n()
  const me = useUser()
  const [name, setName]   = useState('')
  const [key, setKey]     = useState('')
  const [owner, setOwner] = useState<string>(String(me.id))   // user id, or 'service'
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) { setName(''); setKey(''); setOwner(String(me.id)); setError(null) }
  }, [open, me.id])

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      const userId = users ? (owner === 'service' ? null : Number(owner)) : undefined
      const added = await addKey(name.trim(), key.trim(), userId)
      onAdded(added.name)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const label = 'mb-1 block text-[13px] text-slate-500 dark:text-slate-400'

  return (
    <Dialog open={open} title={t.keys.addTitle} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {users && (
          <label className="block">
            <span className={label}>{t.keys.owner}</span>
            <select className="input" value={owner} onChange={(e) => setOwner(e.target.value)}>
              {users.filter((u) => u.active).map((u) => (
                <option key={u.id} value={u.id}>{u.id === me.id ? t.history.me(u.name) : u.name} ({u.username})</option>
              ))}
              <option value="service">{t.keys.ownerService}</option>
            </select>
          </label>
        )}
        <label className="block">
          <span className={label}>{t.keys.name}</span>
          <input className="input" required maxLength={60} placeholder={t.keys.namePlaceholder}
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
