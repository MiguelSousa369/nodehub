import { X } from 'lucide-react'
import { ReactNode, useEffect, useId, useRef } from 'react'

import { useI18n } from '../i18n'

interface DialogProps {
  open    : boolean
  title   : string
  onClose : () => void
  wide?   : boolean      // larger dialog for detail views
  children: ReactNode
}

// ---------------------------------------------------------------------------
// Modal built on the native <dialog> element (showModal): focus stays inside while it's open and
// returns to where it was afterwards, and Escape closes it. Clicking the backdrop or the X closes it too.
// ---------------------------------------------------------------------------

export default function Dialog({ open, title, onClose, wide = false, children }: DialogProps) {
  const { t } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      el.showModal()
      // showModal focuses the first focusable element, which is the close (X) button: typing a space
      // would then close the dialog. Focus the first field instead (or the first other button).
      const first = el.querySelector<HTMLElement>('input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])')
        ?? el.querySelector<HTMLElement>('button:not([data-dialog-close]):not([disabled]), a[href]')
      first?.focus()
    }
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose() }}   // a click on the backdrop
      aria-labelledby={titleId}
      className={`card max-h-[90vh] overflow-y-auto p-0 text-slate-800 shadow-2xl dark:text-slate-200 ${wide
        ? 'w-[min(820px,calc(100vw-32px))]'
        : 'w-[min(520px,calc(100vw-32px))]'}`}
    >
      {/* Inner wrapper so clicks on the padding don't count as backdrop clicks */}
      <div className="p-6">
        <div className="mb-4 flex items-start gap-3">
          <h2 id={titleId} className="flex-1 text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label={t.common.close} data-dialog-close
                  className="-mr-2 -mt-1 rounded-md p-1.5 text-slate-500 hover:bg-surface dark:hover:bg-surface-dark">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
