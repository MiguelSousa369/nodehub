import { FormEvent, useEffect, useState } from 'react'

import { useI18n } from '../i18n'
import { saveMachine, testSsh } from '../services/api'
import type { Machine } from '../types'
import Dialog from './Dialog'

const DEFAULT_SSH_USER = 'nodehub'

interface MachineFormDialogProps {
  machine: Machine | null       // null = closed
  clients: string[]
  onClose: () => void
  onSaved: (host: string) => void
}

type Feedback = { text: string; kind: 'info' | 'ok' | 'error' } | null

/** Configure (unassigned machine) or edit (configured machine). */
export default function MachineFormDialog({ machine, clients, onClose, onSaved }: MachineFormDialogProps) {
  const { t } = useI18n()
  const [client, setClient]     = useState('')
  const [displayName, setDisplayName] = useState('')
  const [sshUser, setSshUser]   = useState(DEFAULT_SSH_USER)
  const [notes, setNotes]       = useState('')
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    if (!machine) return
    setClient(machine.client ?? '')
    setDisplayName(machine.displayName)
    setSshUser(machine.sshUser ?? DEFAULT_SSH_USER)
    setNotes(machine.notes)
    setFeedback(null)
  }, [machine])

  async function runSshTest() {
    if (!machine) return
    setFeedback({ text: t.machineForm.testing, kind: 'info' })
    try {
      const r = await testSsh(machine.host, sshUser.trim())
      const text = r.kind === 'ok' ? t.machineForm.sshOk(r.detail)
        : r.kind === 'timeout' ? t.machineForm.sshTimeout
        : r.detail   // OpenSSH's own message
      setFeedback({ text, kind: r.ok ? 'ok' : 'error' })
    } catch (e) {
      setFeedback({ text: (e as Error).message, kind: 'error' })
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!machine) return
    setSaving(true)
    try {
      await saveMachine(machine.host, {
        client: client.trim(), displayName: displayName.trim(), sshUser: sshUser.trim(), notes: notes.trim(),
      })
      onSaved(machine.host)
    } catch (err) {
      setFeedback({ text: (err as Error).message, kind: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const feedbackColor = { info: '', ok: 'text-online dark:text-online-dark', error: 'text-danger dark:text-danger-dark' }
  const label = 'mb-1 block text-[13px] text-slate-500 dark:text-slate-400'

  return (
    <Dialog
      open={machine !== null}
      title={machine ? (machine.configured ? t.machineForm.editTitle(machine.host) : t.machineForm.configureTitle(machine.host)) : ''}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className={label}>{t.machineForm.client}</span>
          <input className="input" list="client-list" required maxLength={100} autoComplete="off" autoFocus
                 placeholder={t.machineForm.clientPlaceholder}
                 value={client} onChange={(e) => setClient(e.target.value)} />
          <datalist id="client-list">{clients.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label className="block">
          <span className={label}>{t.machineForm.displayName}</span>
          <input className="input" maxLength={60} autoComplete="off" placeholder={t.machineForm.displayNamePlaceholder}
                 value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          {machine && <span className="mt-1 block text-[12px] text-slate-500 dark:text-slate-400">{t.machineForm.displayNameHelp(machine.host)}</span>}
        </label>
        <label className="block">
          <span className={label}>{t.machineForm.sshUser}</span>
          <input className="input" required maxLength={64} pattern="[A-Za-z0-9._\-]+"
                 value={sshUser} onChange={(e) => setSshUser(e.target.value)} />
        </label>
        <label className="block">
          <span className={label}>{t.machineForm.notes}</span>
          <input className="input" maxLength={500} placeholder={t.machineForm.notesPlaceholder}
                 value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <div role="status" className={`min-h-5 text-sm ${feedback ? feedbackColor[feedback.kind] : ''}`}>{feedback?.text}</div>

        <div className="flex gap-2 pt-1">
          <button type="button" className="btn" onClick={runSshTest}>{t.machineForm.testSsh}</button>
          <span className="flex-1" />
          <button type="button" className="btn" onClick={onClose}>{t.common.cancel}</button>
          <button type="submit" className="btn-primary" disabled={saving}>{t.common.save}</button>
        </div>
      </form>
    </Dialog>
  )
}
