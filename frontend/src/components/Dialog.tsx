import { ReactNode, useEffect, useRef } from 'react'

interface DialogProps {
  open    : boolean
  title   : string
  onClose : () => void
  wide?   : boolean      // larger dialog for detail views
  children: ReactNode
}

/** Modal built on the native <dialog> element. */
export default function Dialog({ open, title, onClose, wide = false, children }: DialogProps) {
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
      className={`card max-h-[90vh] overflow-y-auto p-6 text-slate-800 dark:text-slate-200 ${wide
        ? 'w-[min(820px,calc(100vw-32px))]'
        : 'w-[min(520px,calc(100vw-32px))]'}`}
    >
      <h3 className="mb-4 text-lg font-semibold">{title}</h3>
      {children}
    </dialog>
  )
}
