import { useCallback, useEffect, useState } from 'react'

import { ApiError, listMachines } from '../services/api'
import type { MachineList } from '../types'

const REFRESH_MS = 30_000

/** Loads the machine list and refreshes it every 30 seconds. */
export function useMachines(onUnauthorized: () => void) {
  const [data, setData]       = useState<MachineList>({ machines: [], clients: [], tailscaleError: null })
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      setData(await listMachines())
      setError(null)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'UNAUTHORIZED') return onUnauthorized()
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [onUnauthorized])

  useEffect(() => {
    reload()
    const id = setInterval(reload, REFRESH_MS)
    return () => clearInterval(id)
  }, [reload])

  return { ...data, error, loading, reload }
}
