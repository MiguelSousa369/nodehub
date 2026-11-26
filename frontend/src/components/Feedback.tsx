import { ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Loading placeholders and empty states, shared by the pages.
// ---------------------------------------------------------------------------

/** A grey block that pulses while data loads. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200/80 dark:bg-slate-700/50 ${className}`} />
}

/** Placeholder for the dashboard: a group title and a few machine cards. */
export function MachineGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div role="status" aria-label="Loading machines">
      <Skeleton className="mb-3 h-4 w-40" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="card space-y-3 px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-2.5 w-2.5 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-48" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Placeholder for lists of rows (history, users, connected PCs). */
export function ListSkeleton({ rows = 5, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card flex items-center gap-3 px-3 py-3">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-3 w-40 sm:block" />
        </div>
      ))}
    </div>
  )
}

interface EmptyStateProps {
  icon    : ReactNode
  title   : string
  children?: ReactNode   // explanation
  action? : ReactNode    // e.g. a button to get started
}

/** Shown instead of an empty list: what's going on and what to do next. */
export function EmptyState({ icon, title, children, action }: EmptyStateProps) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand dark:bg-brand-dark/15 dark:text-brand-dark"
           aria-hidden="true">
        {icon}
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      {children && <div className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** Inline error or warning banner. */
export function Banner({ kind = 'warn', children }: { kind?: 'warn' | 'danger'; children: ReactNode }) {
  const style = kind === 'danger'
    ? 'border-danger/30 bg-danger/10 text-danger dark:text-danger-dark'
    : 'border-warn/30 bg-warn/10 text-warn dark:text-warn-dark'
  return <div role="alert" className={`mb-5 rounded-lg border px-4 py-2.5 text-sm ${style}`}>{children}</div>
}
