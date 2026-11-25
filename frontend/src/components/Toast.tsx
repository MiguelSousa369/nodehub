export default function Toast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 -translate-x-1/2 animate-fade-in rounded-lg bg-slate-800
                    px-4 py-2 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900">
      {message}
    </div>
  )
}
