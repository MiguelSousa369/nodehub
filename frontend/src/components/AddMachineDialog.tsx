import { useEffect, useState } from 'react'

import { useI18n } from '../i18n'
import { downloadInstaller, getInstallerStatus } from '../services/api'
import type { InstallerStatus } from '../types'
import Dialog from './Dialog'

interface AddMachineDialogProps {
  open   : boolean
  onClose: () => void
}

/** The three steps to add a client PC: download the installer, run it, configure the machine. */
export default function AddMachineDialog({ open, onClose }: AddMachineDialogProps) {
  const { t } = useI18n()
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
    <Dialog open={open} title={t.addMachine.title} onClose={onClose}>
      <ol className="list-decimal space-y-3 pl-5 text-sm">
        <li>
          <button className="btn-primary" disabled={!status?.ready} onClick={download}>{t.addMachine.download}</button>
          {status && !status.ready && (
            <div className="mt-2 text-danger dark:text-danger-dark">
              {t.addMachine.notConfigured}
              <ul className="list-disc pl-5">{status.missing.map((m) => <li key={m}>{t.addMachine.missing[m] ?? m}</li>)}</ul>
            </div>
          )}
          {error && <div className="mt-2 text-danger dark:text-danger-dark">{error}</div>}
        </li>
        <li>{t.addMachine.step2}</li>
        <li>{t.addMachine.step3}</li>
      </ol>
      <p className="mt-4 text-[13px] text-slate-500 dark:text-slate-400">{t.addMachine.warning}</p>
      <div className="mt-5 flex justify-end">
        <button className="btn" onClick={onClose}>{t.common.close}</button>
      </div>
    </Dialog>
  )
}
