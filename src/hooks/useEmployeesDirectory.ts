import { useCallback, useEffect, useState } from 'react'
import { fetchEmployeesDirectory } from '@/lib/employeesApi'
import type { EmployeeDirectoryEntry } from '@/types/employee'

type State = {
  employees: EmployeeDirectoryEntry[]
  count: number
  loading: boolean
  error: string | null
  fetchedAt: string | null
  source: string | null
}

export function useEmployeesDirectory() {
  const [state, setState] = useState<State>({
    employees: [],
    count: 0,
    loading: true,
    error: null,
    fetchedAt: null,
    source: null,
  })

  const reload = useCallback(async (refresh = false) => {
    setState((current) => ({ ...current, loading: true, error: null }))
    try {
      const data = await fetchEmployeesDirectory(refresh)
      setState({
        employees: data.employees,
        count: data.count,
        loading: false,
        error: null,
        fetchedAt: data.fetchedAt,
        source: data.source ?? null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load employees'
      setState((current) => ({
        ...current,
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
