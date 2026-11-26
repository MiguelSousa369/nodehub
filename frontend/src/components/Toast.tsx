/**
 * Short message at the bottom of the screen (see hooks/useToast).
 * The live region is always in the page, so screen readers announce each new message.
 */
export default function Toast({ message }: { message: string | null }) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
      {message && (
        <div className="animate-fade-in-up rounded-lg bg-slate-800 px-4 py-2 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900">
          {message}
        </div>
      )}
    </div>
  )
}
