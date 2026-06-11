import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useGoalsData } from '@/hooks/useGoalsData'
import { usePerformanceData } from '@/hooks/usePerformanceData'
import { useEmployeesDirectory } from '@/hooks/useEmployeesDirectory'
import { GoalsCsvUpload } from '@/components/goals/GoalsCsvUpload'
import { GoalSubmissionStatGrid } from '@/components/goals/GoalSubmissionStatGrid'
import { LoadingState } from '@/components/performance/LoadingState'
import { EmptyState } from '@/components/performance/EmptyState'
import { formatGoalStatusLabel, GoalStatusChip } from '@/components/goals/GoalStatusChip'
import { FilterMultiSelect } from '@/components/performance/FilterMultiSelect'
import { filterActiveEmployees } from '@/lib/activeEmployees'
import { parseQuarterYearFromCycle } from '@/lib/calendarQuarters'
import {
  buildGoalOwnerProfileLookup,
  enrichGoalOwnerProfileLookup,
} from '@/lib/goalOwnerProfiles'
import {
  buildGoalsMonitoringSummary,
  goalMatchesReviewCycle,
  goalReviewCycle,
} from '@/lib/goalsMonitoring'
import type { GoalRecord } from '@/types/goals'
import {
  clearEmployeeGoalsParams,
  employeeGoalsUrl,
  readGoalsFilters,
} from '@/lib/goalsFilters'
import { roleUsesDepartmentScope } from '@/lib/permissions'
import {
  buildGoalRosterIndex,
  departmentOptionsFromRoster,
  employeeMatchesRosterFilters,
  goalMatchesRosterFilters,
  teamOptionsFromRoster,
} from '@/lib/rosterFilters'
import { routes } from '@/lib/routes'
import '@/styles/performance.css'

const DEFAULT_CYCLE_FILTER = 'Q2 2026'
const DEFAULT_APPROVAL_STATUS_KEYS = ['approved', 'pending'] as const

const HIDDEN_GOAL_TABLE_COLUMNS = new Set([
  'progress',
  'means of measure',
  'target value',
])

function normalizeGoalTableColumn(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ')
}

function resolveDefaultApprovalFilter(statuses: string[]): string[] {
  return DEFAULT_APPROVAL_STATUS_KEYS.map((key) =>
    statuses.find((status) => status.toLowerCase() === key),
  ).filter((status): status is string => Boolean(status))
}

function approvalFiltersMatch(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  const normalized = new Set(left.map((value) => value.toLowerCase()))
  return right.every((value) => normalized.has(value.toLowerCase()))
}

function uniqueGoalField(
  goals: GoalRecord[],
  pick: (g: GoalRecord) => string | null | undefined,
): string[] {
  const values = new Set<string>()
  for (const g of goals) {
    const v = pick(g)?.trim()
    if (v) values.add(v)
  }
  return [...values].sort((a, b) => a.localeCompare(b))
}

export default function GoalsPage() {
  const { role, user } = useAuth()
  const scopedDepartments = user?.scopedDepartments ?? null
  const hasDepartmentScope =
    Boolean(role && roleUsesDepartmentScope(role) && scopedDepartments?.length)
  const { goals, dataset, loading, uploading, error, uploadCsv, reload } = useGoalsData()
  const { records, loading: perfLoading } = usePerformanceData()
  const {
    employees: directoryEmployees,
    loading: employeesLoading,
  } = useEmployeesDirectory()
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    employee: employeeFilter,
    owner: ownerFilter,
    search: searchFromUrl,
    cycle: cycleFromUrl,
  } = readGoalsFilters(searchParams)
  const [search, setSearch] = useState(searchFromUrl ?? '')

  useEffect(() => {
    setSearch(searchFromUrl ?? '')
  }, [searchFromUrl])
  useEffect(() => {
    setCycleFilter(cycleFromUrl ?? DEFAULT_CYCLE_FILTER)
  }, [cycleFromUrl])
  const [cycleFilter, setCycleFilter] = useState(cycleFromUrl ?? DEFAULT_CYCLE_FILTER)
  const [statusFilter, setStatusFilter] = useState('')
  const [approvalFilter, setApprovalFilter] = useState<string[]>([])
  const [orgUnitFilter, setOrgUnitFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState<string[]>([])
  const [teamFilter, setTeamFilter] = useState<string[]>([])
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)

  const cycles = useMemo(() => uniqueGoalField(goals, goalReviewCycle), [goals])
  const statuses = useMemo(() => uniqueGoalField(goals, (g) => g.status), [goals])
  const approvalStatuses = useMemo(() => uniqueGoalField(goals, (g) => g.approval_status), [goals])
  const defaultApprovalFilter = useMemo(
    () => resolveDefaultApprovalFilter(approvalStatuses),
    [approvalStatuses],
  )
  const orgUnits = useMemo(() => uniqueGoalField(goals, (g) => g.organisation_unit), [goals])

  useEffect(() => {
    if (approvalStatuses.length === 0 || defaultApprovalFilter.length === 0) return
    setApprovalFilter((current) => (current.length === 0 ? defaultApprovalFilter : current))
  }, [approvalStatuses, defaultApprovalFilter])

  const employeeFilterLabel = useMemo(() => {
    if (!employeeFilter && !ownerFilter) return null
    const match = goals.find((g) => {
      if (employeeFilter && g.employee_id === employeeFilter) return true
      if (ownerFilter && g.owner?.trim().toLowerCase() === ownerFilter.toLowerCase()) return true
      return false
    })
    return match?.employee_name ?? match?.owner_full_name ?? match?.owner ?? employeeFilter ?? ownerFilter
  }, [goals, employeeFilter, ownerFilter])

  const isSearchFilterActive = Boolean(search.trim())
  const isCycleFilterActive = Boolean(cycleFilter)
  const isStatusFilterActive = Boolean(statusFilter)
  const isApprovalFilterActive = approvalFilter.length > 0
  const isOrgUnitFilterActive = Boolean(orgUnitFilter)
  const isDepartmentFilterActive = departmentFilter.length > 0
  const isTeamFilterActive = teamFilter.length > 0

  const rosterFilterState = useMemo(
    () => ({
      departments: departmentFilter,
      teams: teamFilter,
    }),
    [departmentFilter, teamFilter],
  )

  const rosterFiltersActive = isDepartmentFilterActive || isTeamFilterActive

  const hasActiveFilters = Boolean(
    search.trim() ||
      (cycleFilter && cycleFilter !== DEFAULT_CYCLE_FILTER) ||
      statusFilter ||
      (approvalFilter.length > 0 && !approvalFiltersMatch(approvalFilter, defaultApprovalFilter)) ||
      orgUnitFilter ||
      rosterFiltersActive ||
      employeeFilter ||
      ownerFilter,
  )

  const activeRoster = useMemo(
    () => filterActiveEmployees(directoryEmployees),
    [directoryEmployees],
  )

  const goalRosterIndex = useMemo(() => buildGoalRosterIndex(activeRoster), [activeRoster])

  const departmentOptions = useMemo(() => {
    if (hasDepartmentScope && scopedDepartments?.length) {
      return scopedDepartments.map((department) => ({ value: department, label: department }))
    }
    return departmentOptionsFromRoster(activeRoster, rosterFilterState)
  }, [activeRoster, rosterFilterState, hasDepartmentScope, scopedDepartments])

  const teamOptions = useMemo(
    () => teamOptionsFromRoster(activeRoster, rosterFilterState),
    [activeRoster, rosterFilterState],
  )

  useEffect(() => {
    const valid = new Set(departmentOptions.map((option) => option.value))
    setDepartmentFilter((current) => {
      const next = current.filter((value) => valid.has(value))
      return next.length === current.length ? current : next
    })
  }, [departmentOptions])

  useEffect(() => {
    const valid = new Set(teamOptions.map((option) => option.value))
    setTeamFilter((current) => {
      const next = current.filter((value) => valid.has(value))
      return next.length === current.length ? current : next
    })
  }, [teamOptions])

  function onDepartmentFilterChange(next: string[]) {
    if (hasDepartmentScope && scopedDepartments?.length) {
      const allowed = new Set(scopedDepartments)
      setDepartmentFilter(next.filter((department) => allowed.has(department)))
      return
    }
    setDepartmentFilter(next)
  }

  const filteredRoster = useMemo(() => {
    if (!rosterFiltersActive) return activeRoster
    return activeRoster.filter((employee) =>
      employeeMatchesRosterFilters(employee, rosterFilterState),
    )
  }, [activeRoster, rosterFiltersActive, rosterFilterState])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const ownerKey = ownerFilter?.toLowerCase()
    return goals.filter((g) => {
      if (employeeFilter && g.employee_id !== employeeFilter) return false
      if (ownerKey && g.owner?.trim().toLowerCase() !== ownerKey) return false
      if (cycleFilter && !goalMatchesReviewCycle(g, cycleFilter)) return false
      if (statusFilter && (g.status ?? '').toLowerCase() !== statusFilter.toLowerCase()) return false
      if (approvalFilter.length > 0) {
        const status = (g.approval_status ?? '').toLowerCase()
        if (!approvalFilter.some((value) => value.toLowerCase() === status)) {
          return false
        }
      }
      if (orgUnitFilter && (g.organisation_unit ?? '') !== orgUnitFilter) return false
      if (!goalMatchesRosterFilters(g, goalRosterIndex, rosterFilterState)) return false
      if (!q) return true
      const haystack = [
        g.employee_name,
        g.employee_id,
        goalReviewCycle(g),
        g.title,
        g.status,
        g.approval_status,
        g.organisation_unit,
        g.organisation_name,
        g.progress,
        g.owner,
        g.owner_full_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [
    goals,
    search,
    cycleFilter,
    statusFilter,
    approvalFilter,
    orgUnitFilter,
    employeeFilter,
    ownerFilter,
    goalRosterIndex,
    rosterFilterState,
  ])

  const ownerProfileLookup = useMemo(
    () =>
      enrichGoalOwnerProfileLookup(
        buildGoalOwnerProfileLookup(records),
        directoryEmployees,
      ),
    [records, directoryEmployees],
  )

  const monitoringQuarter = useMemo(
    () => parseQuarterYearFromCycle(cycleFilter),
    [cycleFilter],
  )

  const goalsSummary = useMemo(
    () =>
      buildGoalsMonitoringSummary(goals, {
        cycleFilter: cycleFilter || null,
        calendarQuarter: monitoringQuarter?.quarter ?? null,
        calendarYear: monitoringQuarter?.year ?? null,
        performanceRecords: records,
        ownerProfileLookup,
        activeRoster: filteredRoster,
      }),
    [
      goals,
      records,
      cycleFilter,
      monitoringQuarter,
      ownerProfileLookup,
      filteredRoster,
    ],
  )

  const exportStats = useMemo(() => {
    let cycleGoals = cycleFilter
      ? goals.filter((goal) => goalMatchesReviewCycle(goal, cycleFilter))
      : goals
    if (rosterFiltersActive) {
      cycleGoals = cycleGoals.filter((goal) =>
        goalMatchesRosterFilters(goal, goalRosterIndex, rosterFilterState),
      )
    }
    const uniqueGoalIds = new Set(
      cycleGoals.map((goal) => goal.goal_id?.trim() || goal.id).filter(Boolean),
    )
    return {
      metricRows: cycleGoals.length,
      uniqueGoals: uniqueGoalIds.size,
    }
  }, [goals, cycleFilter, rosterFiltersActive, goalRosterIndex, rosterFilterState])

  const clearFilters = () => {
    setSearch('')
    setCycleFilter(DEFAULT_CYCLE_FILTER)
    setStatusFilter('')
    setApprovalFilter(defaultApprovalFilter)
    setOrgUnitFilter('')
    setDepartmentFilter([])
    setTeamFilter([])
    if (employeeFilter || ownerFilter) {
      setSearchParams(clearEmployeeGoalsParams(searchParams), { replace: true })
    }
  }

  const extraColumns = useMemo(() => {
    const cols = dataset?.columns ?? []
    const mapped = new Set(
      Object.values(dataset?.columnMap ?? {}).filter((v): v is string => Boolean(v)),
    )
    return cols
      .filter((c) => !mapped.has(c))
      .filter((c) => !HIDDEN_GOAL_TABLE_COLUMNS.has(normalizeGoalTableColumn(c)))
      .slice(0, 4)
  }, [dataset])

  async function onFileUpload(file: File) {
    setUploadMessage(null)
    try {
      const text = await file.text()
      const result = await uploadCsv(text)
      setUploadMessage(`Imported ${file.name} (${result.goalCount} goals).`)
    } catch {
      /* error surfaced via hook */
    }
  }

  if (loading || perfLoading || employeesLoading) return <LoadingState />

  return (
    <div className="pd-page">
      <header className="pd-page-header">
        <div>
          <h1 className="pd-page-title">Goals</h1>
          <p className="pd-page-subtitle">
            Revolut People does not expose Goals on the public API. Upload the CSV export from
            Revolut (Goals → Export) using Upload CSV below.
          </p>
        </div>
        <GoalsCsvUpload
          uploading={uploading}
          onUpload={onFileUpload}
          onRefresh={() => reload()}
          importedAt={dataset?.importedAt}
          source={dataset?.source}
        />
      </header>

      {error && <div className="pd-alert">{error}</div>}
      {uploadMessage && <p className="pd-page-subtitle">{uploadMessage}</p>}
      {employeeFilterLabel && (
        <p className="pd-page-subtitle" style={{ marginTop: 0 }}>
          Showing goals for <strong>{employeeFilterLabel}</strong>
          {' · '}
          <Link to={routes.goals.root} className="pd-link">
            Show all goals
          </Link>
        </p>
      )}
      {dataset?.hint && goals.length === 0 && (
        <p className="pd-page-subtitle">{dataset.hint}</p>
      )}

      {goals.length > 0 ? (
        <div className="pd-filter-bar pd-filter-bar--compact" style={{ marginBottom: '1rem' }}>
          <div className="pd-form-row pd-filter-search">
            <label className="pd-label" htmlFor="goals-search">
              Search
            </label>
            <input
              id="goals-search"
              className={`pd-input${isSearchFilterActive ? ' pd-filter-control--active' : ''}`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Employee, cycle, title, status…"
            />
          </div>
          <div className="pd-form-row">
            <label className="pd-label" htmlFor="goals-cycle">
              Review cycle
            </label>
            <select
              id="goals-cycle"
              className={`pd-select${isCycleFilterActive ? ' pd-filter-control--active' : ''}`}
              value={cycleFilter}
              onChange={(e) => setCycleFilter(e.target.value)}
            >
              <option value="">All cycles</option>
              {cycles.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="pd-form-row">
            <label className="pd-label" htmlFor="goals-status">
              Goal status
            </label>
            <select
              id="goals-status"
              className={`pd-select${isStatusFilterActive ? ' pd-filter-control--active' : ''}`}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {formatGoalStatusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <FilterMultiSelect
            id="goals-approval"
            label="Approval Status"
            placeholder="All statuses"
            options={approvalStatuses.map((status) => ({
              value: status,
              label: formatGoalStatusLabel(status),
            }))}
            selected={approvalFilter}
            onChange={setApprovalFilter}
            active={isApprovalFilterActive}
          />
          <FilterMultiSelect
            id="goals-department"
            label="Department"
            placeholder={hasDepartmentScope ? 'All your departments' : 'All departments'}
            options={departmentOptions}
            selected={departmentFilter}
            onChange={onDepartmentFilterChange}
            active={isDepartmentFilterActive}
          />
          <FilterMultiSelect
            id="goals-team"
            label="Team"
            placeholder="All teams"
            options={teamOptions}
            selected={teamFilter}
            onChange={setTeamFilter}
            active={isTeamFilterActive}
          />
          <div className="pd-form-row">
            <label className="pd-label" htmlFor="goals-org-unit">
              Organisation unit
            </label>
            <select
              id="goals-org-unit"
              className={`pd-select${isOrgUnitFilterActive ? ' pd-filter-control--active' : ''}`}
              value={orgUnitFilter}
              onChange={(e) => setOrgUnitFilter(e.target.value)}
            >
              <option value="">All units</option>
              {orgUnits.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          {hasActiveFilters ? (
            <button type="button" className="pd-btn-secondary pd-btn" onClick={clearFilters}>
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}

      {goals.length > 0 && activeRoster.length > 0 ? (
        <div style={{ marginBottom: '1rem' }}>
          <GoalSubmissionStatGrid goalsSummary={goalsSummary} exportStats={exportStats} />
        </div>
      ) : null}

      {goals.length === 0 ? (
        <EmptyState
          title="No goals loaded"
          description="Export Goals from Revolut People as CSV, then upload the file above."
        />
      ) : (
        <div className="pd-panel pd-table-wrap">
          <p className="pd-page-subtitle" style={{ padding: '0.75rem 1rem 0' }}>
            Showing {filtered.length} of {goals.length} goals
          </p>
          <table className="pd-table">
            <thead>
              <tr>
                <th>Goal</th>
                <th>Employee</th>
                <th>Cycle</th>
                <th>Status</th>
                <th>Approval status</th>
                {extraColumns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5 + extraColumns.length}
                    style={{ textAlign: 'center', color: '#6b7280' }}
                  >
                    No goals match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((g) => (
                <tr key={g.id}>
                  <td>{g.title ?? '—'}</td>
                  <td>
                    {g.employee_id || g.owner ? (
                      <Link
                        to={
                          employeeGoalsUrl({
                            employeeId: g.employee_id,
                            owner: g.employee_id ? null : g.owner,
                          }) ?? routes.goals.root
                        }
                        className="pd-link"
                      >
                        {g.employee_name ?? g.owner_full_name ?? g.owner ?? g.employee_id}
                      </Link>
                    ) : (
                      (g.employee_name ?? '—')
                    )}
                  </td>
                  <td>{goalReviewCycle(g) ?? '—'}</td>
                  <td>
                    <GoalStatusChip status={g.status} />
                  </td>
                  <td>
                    <GoalStatusChip status={g.approval_status} />
                  </td>
                  {extraColumns.map((col) => (
                    <td key={col}>{g.fields?.[col] || '—'}</td>
                  ))}
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
