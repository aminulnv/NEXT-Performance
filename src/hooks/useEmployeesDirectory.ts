import { useOptionalDataContext } from '@/contexts/DataContext'
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

function useLocalEmployeesDirectory(enabled: boolean) {
  const [state, setState] = useState<State>({
    employees: [],
    count: 0,
    loading: enabled,
    error: null,
    fetchedAt: null,
    source: null,
  })

  const reload = useCallback(async (refresh = false) => {
    if (!enabled) return
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
  }, [enabled])

  const forceReload = useCallback(() => reload(true), [reload])

  useEffect(() => {
    if (!enabled) return
    reload(false)
  }, [enabled, reload])

  return { ...state, reload: forceReload }
}

export function useEmployeesDirectory() {
  const data = useOptionalDataContext()
  const local = useLocalEmployeesDirectory(!data)
  const contextReloadEmployees = data?.reloadEmployees

  const reloadFromContext = useCallback(() => {
    void contextReloadEmployees?.(true)
  }, [contextReloadEmployees])

  if (data) {
    return {
      ...data.employees,
      reload: reloadFromContext,
    }
  }

  return local
}
