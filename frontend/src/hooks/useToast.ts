import { useCallback, useRef, useState } from 'react'

/** Short-lived message at the bottom of the screen. */
export function useToast(durationMs = 2200) {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const show = useCallback((text: string) => {
    clearTimeout(timer.current)
    setMessage(text)
    timer.current = setTimeout(() => setMessage(null), durationMs)
  }, [durationMs])

  return { message, show }
}
