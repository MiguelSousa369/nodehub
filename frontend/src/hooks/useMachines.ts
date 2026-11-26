import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiError, listMachines } from '../services/api'
import type { MachineList } from '../types'

const REFRESH_MS = 30_000

// ---------------------------------------------------------------------------
// Machine list, refreshed every 30 seconds while the tab is visible.
//
// Polling pauses in background tabs (no point asking Tailscale for nobody) and catches up as soon as
// the tab is shown again. `updatedAt` is when the last refresh succeeded, for the "updated … ago" label.
// ---------------------------------------------------------------------------

export function useMachines(onUnauthorized: () => void) {
  const [data, setData]             = useState<MachineList>({ machines: [], clients: [], tailscaleError: null })
  const [error, setError]           = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)    // first load only
  const [refreshing, setRefreshing] = useState(false)   // any load in progress
  const [updatedAt, setUpdatedAt]   = useState<Date | null>(null)
  const inFlight = useRef(false)

  const reload = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setRefreshing(true)
    try {
      setData(await listMachines())
      setError(null)
      setUpdatedAt(new Date())
    } catch (err) {
      if (err instanceof ApiError && err.code === 'UNAUTHORIZED') return onUnauthorized()
      setError((err as Error).message)
    } finally {
      inFlight.current = false
      setLoading(false)
      setRefreshing(false)
    }
  }, [onUnauthorized])

  useEffect(() => {
    reload()
    let timer: ReturnType<typeof setInterval> | undefined

    const start = () => { clearInterval(timer); timer = setInterval(reload, REFRESH_MS) }
    const onVisibility = () => {
      if (document.hidden) return clearInterval(timer)
      reload()
      start()
    }

    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [reload])

  return { ...data, error, loading, refreshing, updatedAt, reload }
}
