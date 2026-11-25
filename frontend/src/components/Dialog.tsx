import { ReactNode, useEffect, useRef } from 'react'

interface DialogProps {
  open    : boolean
  title   : string
  onClose : () => void
  children: ReactNode
}

/** Modal built on the native <dialog> element. */
export default function Dialog({ open, title, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="card w-[min(520px,calc(100vw-32px))] p-6 text-slate-800 dark:text-slate-200"
    >
      <h3 className="mb-4 text-lg font-semibold">{title}</h3>
      {children}
    </dialog>
  )
}
