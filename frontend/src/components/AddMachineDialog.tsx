import { useEffect, useState } from 'react'

import { downloadInstaller, getInstallerStatus } from '../services/api'
import type { InstallerStatus } from '../types'
import Dialog from './Dialog'

interface AddMachineDialogProps {
  open   : boolean
  onClose: () => void
}

export default function AddMachineDialog({ open, onClose }: AddMachineDialogProps) {
  const [status, setStatus] = useState<InstallerStatus | null>(null)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    getInstallerStatus().then(setStatus).catch((e: Error) => setError(e.message))
  }, [open])

  async function download() {
    try {
      await downloadInstaller()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Dialog open={open} title="Add machine" onClose={onClose}>
      <ol className="list-decimal space-y-3 pl-5 text-sm">
        <li>
          <button className="btn-primary" disabled={!status?.ready} onClick={download}>Download installer</button>
          {status && !status.ready && (
            <div className="mt-2 text-danger dark:text-danger-dark">
              Not configured yet:
              <ul className="list-disc pl-5">{status.missing.map((m) => <li key={m}>{m}</li>)}</ul>
            </div>
          )}
          {error && <div className="mt-2 text-danger dark:text-danger-dark">{error}</div>}
        </li>
        <li>
          Take the file to the client PC and <b>right-click → Run with PowerShell</b>.
          Accept the administrator prompt. Nothing needs to be typed.
        </li>
        <li>
          When it finishes, the machine shows up here under <b>Unassigned</b> (within 30 seconds).
          Click <b>Configure</b> and pick the client.
        </li>
      </ol>
      <p className="mt-4 text-[13px] text-slate-500 dark:text-slate-400">
        The installer contains the support network's access key and deletes itself when it finishes.
        Don't leave it lying around in emails or USB drives.
      </p>
      <div className="mt-5 flex justify-end">
        <button className="btn" onClick={onClose}>Close</button>
      </div>
    </Dialog>
  )
}
