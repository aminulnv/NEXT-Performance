import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { fetchAllPerformanceRecords } from '@/lib/performanceApi'
import { fetchEmployeesDirectory } from '@/lib/employeesApi'
import { fetchGoals, uploadGoalsCsv } from '@/lib/goalsApi'
import { readBrowserCache, writeBrowserCache } from '@/lib/browserCache'
import { buildDashboardSummary } from '@/lib/metrics'
import type { DashboardSummary, PerformanceRecord } from '@/types/performance'
import type { EmployeeDirectoryEntry } from '@/types/employee'
import type { GoalsDataset } from '@/types/goals'

type PerformanceCachePayload = {
  records: PerformanceRecord[]
  fetchedAt: string
  cacheStatus?: string | null
  warning?: string | null
}

type EmployeesCachePayload = {
  employees: EmployeeDirectoryEntry[]
  count: number
  fetchedAt: string
  source?: string | null
}

type PerformanceState = {
  records: PerformanceRecord[]
  summary: DashboardSummary | null
  loading: boolean
  error: string | null
  cacheStatus: string | null
  warning: string | null
}

type EmployeesState = {
  employees: EmployeeDirectoryEntry[]
  count: number
  loading: boolean
  error: string | null
  fetchedAt: string | null
  source: string | null
}

type GoalsState = {
  dataset: GoalsDataset | null
  loading: boolean
  uploading: boolean
  error: string | null
}

type DataContextValue = {
  performance: PerformanceState
  employees: EmployeesState
  goals: GoalsState
  reloadPerformance: (refresh?: boolean) => Promise<void>
  reloadEmployees: (refresh?: boolean) => Promise<void>
  reloadGoals: () => Promise<void>
  uploadGoalsCsv: (csvText: string) => Promise<GoalsDataset>
}

const DataContext = createContext<DataContextValue | null>(null)

const emptyPerformance: PerformanceState = {
  records: [],
  summary: null,
  loading: true,
  error: null,
  cacheStatus: null,
  warning: null,
}

const emptyEmployees: EmployeesState = {
  employees: [],
  count: 0,
  loading: true,
  error: null,
  fetchedAt: null,
  source: null,
}

const emptyGoals: GoalsState = {
  dataset: null,
  loading: true,
  uploading: false,
  error: null,
}

function userCacheKey(user: { id: string; email: string } | null): string {
  if (!user) return 'anonymous'
  return user.id || user.email
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const userKey = userCacheKey(user)
  const userKeyRef = useRef(userKey)
  userKeyRef.current = userKey

  const [performance, setPerformance] = useState<PerformanceState>(emptyPerformance)
  const [employees, setEmployees] = useState<EmployeesState>(emptyEmployees)
  const [goals, setGoals] = useState<GoalsState>(emptyGoals)

  const reloadPerformance = useCallback(async (refresh = false) => {
    const key = userKeyRef.current
    setPerformance((current) => ({ ...current, loading: true, error: null, warning: null }))

    if (!refresh) {
      const cached = await readBrowserCache<PerformanceCachePayload>('performance', key)
      if (cached?.data.records.length) {
        const summary = buildDashboardSummary(cached.data.records)
        summary.lastSyncedAt = cached.data.fetchedAt
        setPerformance({
          records: cached.data.records,
          summary,
          loading: true,
          error: null,
          cacheStatus: cached.data.cacheStatus ?? 'browser',
          warning: cached.data.warning ?? null,
        })
      }
    }

    try {
      const { records, fetchedAt, cacheStatus, warning } =
        await fetchAllPerformanceRecords(refresh)
      if (records.length === 0) {
        setPerformance((current) => {
          if (current.records.length === 0) {
            return {
              ...current,
              loading: false,
              cacheStatus: cacheStatus ?? current.cacheStatus,
              warning: warning ?? current.warning,
            }
          }
          return {
            ...current,
            loading: false,
            cacheStatus: cacheStatus ?? current.cacheStatus,
            warning: warning ?? current.warning ?? 'Showing cached data while sync completes.',
          }
        })
        return
      }
      const summary = buildDashboardSummary(records)
      summary.lastSyncedAt = fetchedAt
      setPerformance({
        records,
        summary,
        loading: false,
        error: null,
        cacheStatus: cacheStatus ?? null,
        warning: warning ?? null,
      })
      await writeBrowserCache<PerformanceCachePayload>(
        'performance',
        key,
        { records, fetchedAt, cacheStatus, warning },
        fetchedAt,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load performance data'
      setPerformance((current) => ({
        ...current,
        loading: false,
        error: current.records.length ? null : message,
        warning: current.records.length ? message : current.warning,
      }))
    }
  }, [])

  const reloadEmployees = useCallback(async (refresh = false) => {
    const key = userKeyRef.current
    setEmployees((current) => ({ ...current, loading: true, error: null }))

    if (!refresh) {
      const cached = await readBrowserCache<EmployeesCachePayload>('employees', key)
      if (cached?.data.employees.length) {
        setEmployees({
          employees: cached.data.employees,
          count: cached.data.count,
          loading: true,
          error: null,
          fetchedAt: cached.data.fetchedAt,
          source: cached.data.source ?? 'browser',
        })
      }
    }

    try {
      const data = await fetchEmployeesDirectory(refresh)
      if (data.employees.length === 0) {
        setEmployees((current) => {
          if (current.employees.length === 0) {
            return {
              ...current,
              loading: false,
              fetchedAt: data.fetchedAt,
              source: data.source ?? current.source,
            }
          }
          return {
            ...current,
            loading: false,
            fetchedAt: data.fetchedAt,
            source: data.source ?? current.source,
          }
        })
        return
      }
      setEmployees({
        employees: data.employees,
        count: data.count,
        loading: false,
        error: null,
        fetchedAt: data.fetchedAt,
        source: data.source ?? null,
      })
      await writeBrowserCache<EmployeesCachePayload>(
        'employees',
        key,
        {
          employees: data.employees,
          count: data.count,
          fetchedAt: data.fetchedAt,
          source: data.source,
        },
        data.fetchedAt,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load employees'
      setEmployees((current) => ({
        ...current,
        loading: false,
        error: current.employees.length ? null : message,
      }))
    }
  }, [])

  const reloadGoals = useCallback(async () => {
    const key = userKeyRef.current
    setGoals((current) => ({ ...current, loading: true, error: null }))

    const cached = await readBrowserCache<GoalsDataset>('goals', key)
    if (cached?.data.goals?.length) {
      setGoals({ dataset: cached.data, loading: true, uploading: false, error: null })
    }

    try {
      const dataset = await fetchGoals()
      setGoals({ dataset, loading: false, uploading: false, error: null })
      await writeBrowserCache('goals', key, dataset, dataset.importedAt ?? new Date().toISOString())
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load goals'
      setGoals((current) => ({
        ...current,
        loading: false,
        error: current.dataset?.goals?.length ? null : message,
      }))
    }
  }, [])

  const uploadCsv = useCallback(async (csvText: string) => {
    const key = userKeyRef.current
    setGoals((current) => ({ ...current, uploading: true, error: null }))
    try {
      const dataset = await uploadGoalsCsv(csvText)
      setGoals({ dataset, loading: false, uploading: false, error: null })
      await writeBrowserCache('goals', key, dataset, dataset.importedAt ?? new Date().toISOString())
      return dataset
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload goals CSV'
      setGoals((current) => ({ ...current, uploading: false, error: message }))
      throw err
    }
  }, [])

  useEffect(() => {
    if (authLoading || !user) {
      setPerformance(emptyPerformance)
      setEmployees(emptyEmployees)
      setGoals(emptyGoals)
      return
    }

    void reloadPerformance(false)
    void reloadEmployees(false)
    void reloadGoals()
  }, [authLoading, user, userKey, reloadPerformance, reloadEmployees, reloadGoals])

  const value = useMemo<DataContextValue>(
    () => ({
      performance,
      employees,
      goals,
      reloadPerformance,
      reloadEmployees,
      reloadGoals,
      uploadGoalsCsv: uploadCsv,
    }),
    [
      performance,
      employees,
      goals,
      reloadPerformance,
      reloadEmployees,
      reloadGoals,
      uploadCsv,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useDataContext(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) {
    throw new Error('useDataContext must be used within DataProvider')
  }
  return ctx
}

export function useOptionalDataContext(): DataContextValue | null {
  return useContext(DataContext)
}
