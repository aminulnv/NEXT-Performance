import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useGoalsData } from '@/hooks/useGoalsData'
import { GoalsCsvUpload } from '@/components/goals/GoalsCsvUpload'
import { LoadingState } from '@/components/performance/LoadingState'
import { EmptyState } from '@/components/performance/EmptyState'
import { formatGoalStatusLabel, GoalStatusChip } from '@/components/goals/GoalStatusChip'
import { StatCard } from '@/components/performance/StatCard'
import { goalMatchesReviewCycle, goalReviewCycle } from '@/lib/goalsMonitoring'
import { GOALS_METRIC_HELP } from '@/lib/goalsMetricHelp'
import type { GoalRecord } from '@/types/goals'
import {
  clearEmployeeGoalsParams,
  employeeGoalsUrl,
  readGoalsFilters,
} from '@/lib/goalsFilters'
import { routes } from '@/lib/routes'
import '@/styles/performance.css'

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

function summarizeGoalRows(rows: GoalRecord[]) {
  const goalStatuses = new Map<string, { hasDraft: boolean; hasSubmitted: boolean }>()
  const owners = new Set<string>()

  for (const goal of rows) {
    const goalId = goal.goal_id?.trim() || goal.id
    if (goalId) {
      const status = (goal.approval_status ?? '').toLowerCase()
      const entry = goalStatuses.get(goalId) ?? { hasDraft: false, hasSubmitted: false }
      if (status === 'draft') entry.hasDraft = true
      else if (status) entry.hasSubmitted = true
      goalStatuses.set(goalId, entry)
    }

    const owner =
      goal.owner?.trim().toLowerCase() ??
      goal.employee_name?.trim().toLowerCase() ??
      goal.owner_full_name?.trim().toLowerCase()
    if (owner) owners.add(owner)
  }

  let submittedGoals = 0
  let draftGoals = 0
  for (const entry of goalStatuses.values()) {
    if (entry.hasSubmitted) submittedGoals += 1
    else if (entry.hasDraft) draftGoals += 1
  }

  return {
    metricRows: rows.length,
    uniqueGoals: goalStatuses.size,
    submittedGoals,
    draftGoals,
    people: owners.size,
  }
}

export default function GoalsPage() {
  const { goals, dataset, loading, uploading, error, uploadCsv, reload } = useGoalsData()
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
    setCycleFilter(cycleFromUrl ?? '')
  }, [cycleFromUrl])
  const [cycleFilter, setCycleFilter] = useState(cycleFromUrl ?? '')
  const [statusFilter, setStatusFilter] = useState('')
  const [approvalFilter, setApprovalFilter] = useState('')
  const [orgUnitFilter, setOrgUnitFilter] = useState('')
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)

  const cycles = useMemo(() => uniqueGoalField(goals, goalReviewCycle), [goals])
  const statuses = useMemo(() => uniqueGoalField(goals, (g) => g.status), [goals])
  const approvalStatuses = useMemo(() => uniqueGoalField(goals, (g) => g.approval_status), [goals])
  const orgUnits = useMemo(() => uniqueGoalField(goals, (g) => g.organisation_unit), [goals])

  const employeeFilterLabel = useMemo(() => {
    if (!employeeFilter && !ownerFilter) return null
    const match = goals.find((g) => {
      if (employeeFilter && g.employee_id === employeeFilter) return true
      if (ownerFilter && g.owner?.trim().toLowerCase() === ownerFilter.toLowerCase()) return true
      return false
    })
    return match?.employee_name ?? match?.owner_full_name ?? match?.owner ?? employeeFilter ?? ownerFilter
  }, [goals, employeeFilter, ownerFilter])

  const hasActiveFilters = Boolean(
    search.trim() ||
      cycleFilter ||
      statusFilter ||
      approvalFilter ||
      orgUnitFilter ||
      employeeFilter ||
      ownerFilter,
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const ownerKey = ownerFilter?.toLowerCase()
    return goals.filter((g) => {
      if (employeeFilter && g.employee_id !== employeeFilter) return false
      if (ownerKey && g.owner?.trim().toLowerCase() !== ownerKey) return false
      if (cycleFilter && !goalMatchesReviewCycle(g, cycleFilter)) return false
      if (statusFilter && (g.status ?? '').toLowerCase() !== statusFilter.toLowerCase()) return false
      if (
        approvalFilter &&
        (g.approval_status ?? '').toLowerCase() !== approvalFilter.toLowerCase()
      ) {
        return false
      }
      if (orgUnitFilter && (g.organisation_unit ?? '') !== orgUnitFilter) return false
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
  }, [goals, search, cycleFilter, statusFilter, approvalFilter, orgUnitFilter, employeeFilter, ownerFilter])

  const goalStats = useMemo(() => summarizeGoalRows(filtered), [filtered])

  const clearFilters = () => {
    setSearch('')
    setCycleFilter('')
    setStatusFilter('')
    setApprovalFilter('')
    setOrgUnitFilter('')
    if (employeeFilter || ownerFilter) {
      setSearchParams(clearEmployeeGoalsParams(searchParams), { replace: true })
    }
  }

  const extraColumns = useMemo(() => {
    const cols = dataset?.columns ?? []
    const mapped = new Set(
      Object.values(dataset?.columnMap ?? {}).filter((v): v is string => Boolean(v)),
    )
    return cols.filter((c) => !mapped.has(c)).slice(0, 4)
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

  if (loading) return <LoadingState />

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
        <div className="pd-filter-bar" style={{ marginBottom: '1rem' }}>
          <div className="pd-form-row pd-filter-search">
            <label className="pd-label" htmlFor="goals-search">
              Search
            </label>
            <input
              id="goals-search"
              className="pd-input"
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
              className="pd-select"
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
              className="pd-select"
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
          <div className="pd-form-row">
            <label className="pd-label" htmlFor="goals-approval">
              Approval
            </label>
            <select
              id="goals-approval"
              className="pd-select"
              value={approvalFilter}
              onChange={(e) => setApprovalFilter(e.target.value)}
            >
              <option value="">All</option>
              {approvalStatuses.map((s) => (
                <option key={s} value={s}>
                  {formatGoalStatusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="pd-form-row">
            <label className="pd-label" htmlFor="goals-org-unit">
              Organisation unit
            </label>
            <select
              id="goals-org-unit"
              className="pd-select"
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

      {goals.length > 0 ? (
        <div className="pd-stat-grid pd-stat-grid--wrap" style={{ marginBottom: '1rem' }}>
          <StatCard
            label="Metric rows"
            value={goalStats.metricRows}
            hint={hasActiveFilters ? 'Matching current filters' : 'CSV export rows'}
            labelHelp={GOALS_METRIC_HELP.metricRows}
          />
          <StatCard
            label="Unique goals"
            value={goalStats.uniqueGoals}
            hint="Rolled up by Goal ID"
            labelHelp={GOALS_METRIC_HELP.uniqueGoals}
          />
          <StatCard
            label="Submitted goals"
            value={goalStats.submittedGoals}
            accent="success"
            hint={`${goalStats.people.toLocaleString()} ${goalStats.people === 1 ? 'person' : 'people'}`}
            labelHelp={GOALS_METRIC_HELP.submittedGoalsExport}
          />
          <StatCard
            label="Draft goals"
            value={goalStats.draftGoals}
            accent="warning"
            labelHelp={GOALS_METRIC_HELP.draftGoalsExport}
          />
          <StatCard
            label="People"
            value={goalStats.people}
            hint="Distinct owners in scope"
            labelHelp={GOALS_METRIC_HELP.peopleWithGoals}
          />
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
                <th>Progress</th>
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
                  <td>{g.progress ?? '—'}</td>
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
