import { apiFetch } from '@/lib/api'
import type { EmployeeDirectoryEntry } from '@/types/employee'

type ApiResponse = {
  employees: EmployeeDirectoryEntry[]
  count: number
  fetchedAt: string
  source?: string
  refreshing?: boolean
  error?: string
}

export async function fetchEmployeesDirectory(refresh = false): Promise<{
  employees: EmployeeDirectoryEntry[]
  count: number
  fetchedAt: string
  source?: string
}> {
  const url = `/api/employees${refresh ? '?refresh=1' : ''}`
  const res = await apiFetch(url)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiResponse
    const msg = typeof body.error === 'string' ? body.error : `HTTP ${res.status}`
    throw new Error(msg)
  }
  const data = (await res.json()) as ApiResponse
  return {
    employees: data.employees ?? [],
    count: data.count ?? data.employees?.length ?? 0,
    fetchedAt: data.fetchedAt,
    source: data.source,
  }
}
