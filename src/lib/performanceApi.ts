import { apiFetch } from '@/lib/api'
import type { PerformanceRecord } from '@/types/performance'

type ApiResponse = {
  fetchedAt: string
  recordCount: number
  records: PerformanceRecord[]
  cacheStatus?: string
  refreshing?: boolean
  warning?: string
}

export async function fetchAllPerformanceRecords(refresh = false): Promise<{
  records: PerformanceRecord[]
  fetchedAt: string
  cacheStatus?: string
  warning?: string
}> {
  const url = `/api/performance-records${refresh ? '?refresh=1' : ''}`
  const res = await apiFetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg = typeof body.error === 'string' ? body.error : `HTTP ${res.status}`
    throw new Error(msg)
  }
  const data = (await res.json()) as ApiResponse
  return {
    records: data.records,
    fetchedAt: data.fetchedAt,
    cacheStatus: data.cacheStatus,
    warning: data.warning,
  }
}
