import { useCallback, useState } from 'react'

/**
 * useState that survives reloads, kept in localStorage under `key` as JSON.
 * Falls back to `initial` when storage is blocked or holds something unreadable.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? initial : (JSON.parse(raw) as T)
    } catch {
      return initial
    }
  })

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next
      try {
        localStorage.setItem(key, JSON.stringify(resolved))
      } catch { /* storage blocked: keep it for this page only */ }
      return resolved
    })
  }, [key])

  return [value, set] as const
}
