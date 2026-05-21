import { useCallback, useEffect, useState } from 'react'
import { fetchAllPerformanceRecords } from '@/lib/performanceApi'
import { buildDashboardSummary } from '@/lib/metrics'
import type { DashboardSummary, PerformanceRecord } from '@/types/performance'

type State = {
  records: PerformanceRecord[]
  summary: DashboardSummary | null
  loading: boolean
  error: string | null
  cacheStatus: string | null
  warning: string | null
}

export function usePerformanceData() {
  const [state, setState] = useState<State>({
    records: [],
    summary: null,
    loading: true,
    error: null,
    cacheStatus: null,
    warning: null,
  })

  const reload = useCallback(async (refresh = false) => {
    setState((s) => ({ ...s, loading: true, error: null, warning: null }))
    try {
      const { records, fetchedAt, cacheStatus, warning } =
        await fetchAllPerformanceRecords(refresh)
      const summary = buildDashboardSummary(records)
      summary.lastSyncedAt = fetchedAt
      setState({
        records,
        summary,
        loading: false,
        error: null,
        cacheStatus: cacheStatus ?? null,
        warning: warning ?? null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load performance data'
      setState((s) => ({
        ...s,
        loading: false,
        error: message,
      }))
    }
  }, [])

  useEffect(() => {
    reload(false)
  }, [reload])

  return { ...state, reload: () => reload(true) }
}
