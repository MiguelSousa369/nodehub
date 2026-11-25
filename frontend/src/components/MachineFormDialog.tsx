import { FormEvent, useEffect, useState } from 'react'

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
  const [client, setClient]     = useState('')
  const [sshUser, setSshUser]   = useState(DEFAULT_SSH_USER)
  const [notes, setNotes]       = useState('')
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    if (!machine) return
    setClient(machine.client ?? '')
    setSshUser(machine.sshUser ?? DEFAULT_SSH_USER)
    setNotes(machine.notes)
    setFeedback(null)
  }, [machine])

  async function runSshTest() {
    if (!machine) return
    setFeedback({ text: 'Testing…', kind: 'info' })
    try {
      const r = await testSsh(machine.host, sshUser.trim())
      setFeedback({ text: r.message, kind: r.ok ? 'ok' : 'error' })
    } catch (e) {
      setFeedback({ text: (e as Error).message, kind: 'error' })
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!machine) return
    setSaving(true)
    try {
      await saveMachine(machine.host, { client: client.trim(), sshUser: sshUser.trim(), notes: notes.trim() })
      onSaved(machine.host)
    } catch (err) {
      setFeedback({ text: (err as Error).message, kind: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const feedbackColor = { info: '', ok: 'text-online dark:text-online-dark', error: 'text-danger dark:text-danger-dark' }

  return (
    <Dialog
      open={machine !== null}
      title={machine ? `${machine.configured ? 'Edit' : 'Configure'} ${machine.host}` : ''}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[13px] text-slate-500 dark:text-slate-400">Client</span>
          <input className="input" list="client-list" required maxLength={100} autoComplete="off" autoFocus
                 placeholder="Pick from the list or type a new client"
                 value={client} onChange={(e) => setClient(e.target.value)} />
          <datalist id="client-list">{clients.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label className="block">
          <span className="mb-1 block text-[13px] text-slate-500 dark:text-slate-400">SSH user</span>
          <input className="input" required maxLength={64} pattern="[A-Za-z0-9._\-]+"
                 value={sshUser} onChange={(e) => setSshUser(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[13px] text-slate-500 dark:text-slate-400">Notes</span>
          <input className="input" maxLength={500} placeholder="e.g. Front desk PC"
                 value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <div className={`min-h-5 text-sm ${feedback ? feedbackColor[feedback.kind] : ''}`}>{feedback?.text}</div>

        <div className="flex gap-2 pt-1">
          <button type="button" className="btn" onClick={runSshTest}>Test SSH</button>
          <span className="flex-1" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>Save</button>
        </div>
      </form>
    </Dialog>
  )
}
