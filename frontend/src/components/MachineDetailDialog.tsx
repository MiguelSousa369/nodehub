import { useEffect, useState } from 'react'

import { getMachine, listSessions, updateProfile } from '../services/api'
import type { MachineDetail, Session } from '../types'
import Dialog from './Dialog'
import { ListSkeleton } from './Feedback'
import SessionItem from './SessionItem'

interface MachineDetailDialogProps {
  host   : string | null    // null = closed
  onClose: () => void
}

/** Machine profile (editable) and its full session history. */
export default function MachineDetailDialog({ host, onClose }: MachineDetailDialogProps) {
  const [detail, setDetail]     = useState<MachineDetail | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [editing, setEditing]   = useState(false)
  const [draft, setDraft]       = useState('')
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    if (!host) return
    setDetail(null); setEditing(false); setError(null)
    getMachine(host)
      .then((d) => { setDetail(d); setSessions(d.recentSessions) })
      .catch((e: Error) => setError(e.message))
  }, [host])

  async function loadAll() {
    if (!host) return
    const { sessions: all } = await listSessions({ host, limit: 200 })
    setSessions(all)
  }

  async function saveProfile() {
    if (!host) return
    try {
      await updateProfile(host, draft)
      setDetail((d) => (d ? { ...d, profile: draft } : d))
      setEditing(false)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Dialog open={host !== null} title={host ?? ''} onClose={onClose} wide>
      {error && <div className="mb-3 text-sm text-danger dark:text-danger-dark">{error}</div>}
      {!detail && !error && <ListSkeleton rows={3} label="Loading machine" />}

      {detail && (
        <div className="space-y-5">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {detail.client} · SSH user {detail.sshUser}{detail.notes && ` · ${detail.notes}`}
          </div>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-semibold">Profile</h4>
              {!editing && <button className="btn" onClick={() => { setDraft(detail.profile); setEditing(true) }}>Edit</button>}
            </div>
            {editing ? (
              <>
                <textarea className="input min-h-[160px] font-mono" value={draft} onChange={(e) => setDraft(e.target.value)}
                          placeholder={'- **Role:** server / workstation\n- **OS:**\n- **Hardware:**\n- **Important software:**\n- **Quirks:**'} />
                <div className="mt-2 flex justify-end gap-2">
                  <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
                  <button className="btn-primary" onClick={saveProfile}>Save profile</button>
                </div>
              </>
            ) : (
              <div className="whitespace-pre-wrap rounded-lg bg-surface p-3 text-sm dark:bg-surface-dark">
                {detail.profile || <span className="text-slate-500">No profile yet. Claude fills it in during sessions, or edit it here.</span>}
              </div>
            )}
          </section>

          <section>
            <h4 className="mb-2 font-semibold">Sessions ({detail.totalSessions})</h4>
            {sessions.length === 0 && <div className="text-sm text-slate-500">No sessions recorded yet.</div>}
            <div className="space-y-2">{sessions.map((s) => <SessionItem key={s.id} session={s} />)}</div>
            {sessions.length < detail.totalSessions && (
              <button className="btn mt-3" onClick={loadAll}>Show all {detail.totalSessions}</button>
            )}
          </section>

          <div className="flex justify-end">
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
