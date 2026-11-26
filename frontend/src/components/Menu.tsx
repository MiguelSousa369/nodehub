import { KeyboardEvent, ReactNode, useEffect, useId, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Dropdown menu: a trigger button and a list of items.
//
// Closes on outside click, Escape (focus returns to the trigger) and after picking an item.
// Arrow keys move between items, as in a native menu.
// ---------------------------------------------------------------------------

export interface MenuItem {
  label   : string
  icon?   : ReactNode
  onClick : () => void
  danger? : boolean
}

interface MenuProps {
  /** Contents of the trigger button. */
  trigger     : ReactNode
  /** Accessible name of the trigger (required when it only shows an icon). */
  label       : string
  items       : (MenuItem | 'separator')[]
  /** Shown above the items, e.g. who is signed in. */
  header?     : ReactNode
  /** Extra content below the items, e.g. the theme switch. */
  footer?     : ReactNode
  triggerClass?: string
}

export default function Menu({ trigger, label, items, header, footer, triggerClass = '' }: MenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef    = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef    = useRef<HTMLDivElement>(null)
  const menuId     = useId()

  // Close when clicking outside
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  // Focus the first item when opened from the keyboard or mouse, so arrows work right away
  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
  }, [open])

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
      triggerRef.current?.focus()
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const buttons = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])]
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = e.key === 'ArrowDown' ? index + 1 : index - 1
    buttons[(next + buttons.length) % buttons.length]?.focus()
  }

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={triggerClass}
      >{trigger}</button>

      {open && (
        <div
          id={menuId}
          ref={listRef}
          role="menu"
          aria-label={label}
          className="card absolute right-0 top-full z-30 mt-1.5 min-w-[200px] animate-pop p-1 shadow-xl"
        >
          {header && <div className="border-b border-slate-200 px-2.5 pb-2 pt-1.5 dark:border-slate-700/60">{header}</div>}
          {items.map((item, i) => item === 'separator'
            ? <div key={`sep-${i}`} role="separator" className="my-1 border-t border-slate-200 dark:border-slate-700/60" />
            : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => { setOpen(false); item.onClick() }}
                className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm outline-none
                            hover:bg-surface focus-visible:bg-surface dark:hover:bg-surface-dark dark:focus-visible:bg-surface-dark
                            ${item.danger ? 'text-danger dark:text-danger-dark' : ''}`}
              >
                {item.icon && <span className="flex-none opacity-80" aria-hidden="true">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          {footer && <div className="border-t border-slate-200 px-2.5 pb-1.5 pt-2 dark:border-slate-700/60">{footer}</div>}
        </div>
      )}
    </div>
  )
}
