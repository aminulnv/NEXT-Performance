import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useGoalsData } from '@/hooks/useGoalsData'
import { usePerformanceData } from '@/hooks/usePerformanceData'
import { GoalsCsvUpload } from '@/components/goals/GoalsCsvUpload'
import { LoadingState } from '@/components/performance/LoadingState'
import { EmptyState } from '@/components/performance/EmptyState'
import { StatCard } from '@/components/performance/StatCard'
import { paginate, TablePagination } from '@/components/performance/TablePagination'
import { RatingDistributionPanel } from '@/components/performance/RatingDistributionPanel'
import {
  CALENDAR_QUARTERS,
  currentCalendarQuarter,
  currentCalendarYear,
  type CalendarQuarter,
} from '@/lib/calendarQuarters'
import { CheckInCompletionPanel } from '@/components/goals/CheckInCompletionPanel'
import {
  buildCheckInCompletionSummary,
  buildGoalsMonitoringSummary,
  buildManagersPendingApproval,
  buildRatingMonitoringSummary,
  uniqueReviewCycles,
} from '@/lib/goalsMonitoring'
import { GOALS_METRIC_HELP } from '@/lib/goalsMetricHelp'
import {
  buildGoalOwnerProfileLookup,
  employeeToFlagPersonRow,
  managerPendingToFlagPersonRow,
  type FlagPersonRow,
} from '@/lib/goalOwnerProfiles'
import type { EmployeeGoalStatus } from '@/lib/goalsMonitoring'
import { PersonAvatar } from '@/components/performance/PersonAvatar'
import { uniqueFieldValues } from '@/lib/metrics'
import '@/styles/performance.css'

const DEV_PERFORMERS_PAGE_SIZE = 10

function FlagPanel({
  title,
  rows,
  emptyText,
  showPendingGoalCount = false,
}: {
  title: string
  rows: FlagPersonRow[]
  emptyText: string
  showPendingGoalCount?: boolean
}) {
  return (
    <Panel title={title}>
      {rows.length === 0 ? (
        <p className="pd-page-subtitle" style={{ margin: 0 }}>
          {emptyText}
        </p>
      ) : (
        <table className="pd-flag-people-table">
          <thead>
            <tr>
              <th className="pd-flag-people-table__avatar-col" scope="col">
                <span className="pd-sr-only">Avatar</span>
              </th>
              <th scope="col">Name</th>
              <th scope="col">Department</th>
              {showPendingGoalCount && <th scope="col">Pending goals</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="pd-flag-people-table__avatar-col">
                  <PersonAvatar name={row.name} avatarUrl={row.avatarUrl} size={32} />
                </td>
                <td className="pd-flag-people-table__name">{row.name}</td>
                <td className="pd-flag-people-table__dept pd-muted">{row.department}</td>
                {showPendingGoalCount && (
                  <td className="pd-flag-people-table__count">{row.pendingGoalCount ?? 0}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="pd-panel pd-flag-panel">
      <h3 className="pd-panel-title">{title}</h3>
      {children}
    </div>
  )
}

function FlagPanelGrid({ children }: { children: ReactNode }) {
  return <div className="pd-flag-grid">{children}</div>
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: ReactNode
  children?: ReactNode
}) {
  return (
    <section className="pd-section" style={{ marginTop: '2rem' }}>
      <h2 className="pd-section-title">{title}</h2>
      {description && <p className="pd-section-desc">{description}</p>}
      {children}
    </section>
  )
}

export default function MonitoringPage() {
  const {
    goals,
    dataset,
    loading: goalsLoading,
    uploading,
    error: goalsError,
    uploadCsv,
    reload,
  } = useGoalsData()
  const { records, loading: perfLoading, error: perfError } = usePerformanceData()

  const cycles = useMemo(() => uniqueReviewCycles(goals), [goals])
  const perfCycles = useMemo(() => uniqueFieldValues(records, 'cycle_name'), [records])

  const [cycleFilter, setCycleFilter] = useState('')
  const [perfCycleFilter, setPerfCycleFilter] = useState('')
  const [devSearch, setDevSearch] = useState('')
  const [devDeptFilter, setDevDeptFilter] = useState('')
  const [devCycleFilter, setDevCycleFilter] = useState('')
  const [devRatingFilter, setDevRatingFilter] = useState('')
  const [devPage, setDevPage] = useState(1)
  const [calendarQuarter, setCalendarQuarter] = useState<CalendarQuarter | null>(() =>
    currentCalendarQuarter(),
  )
  const [calendarYear, setCalendarYear] = useState(() => currentCalendarYear())
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const quarterSelected = calendarQuarter != null

  const yearOptions = useMemo(() => {
    const y = currentCalendarYear()
    return [y - 1, y, y + 1]
  }, [])

  const goalsSummary = useMemo(
    () =>
      buildGoalsMonitoringSummary(goals, {
        cycleFilter: cycleFilter || null,
        calendarQuarter: quarterSelected ? calendarQuarter : null,
        calendarYear: quarterSelected ? calendarYear : null,
      }),
    [goals, cycleFilter, calendarQuarter, calendarYear, quarterSelected],
  )

  const checkInSummary = useMemo(() => {
    if (!quarterSelected || calendarQuarter == null) return null
    return buildCheckInCompletionSummary(goals, {
      monitoringQuarter: calendarQuarter,
      monitoringYear: calendarYear,
    })
  }, [goals, calendarQuarter, calendarYear, quarterSelected])

  const ratingSummary = useMemo(
    () => buildRatingMonitoringSummary(records, perfCycleFilter || null),
    [records, perfCycleFilter],
  )

  const ownerProfileLookup = useMemo(
    () => buildGoalOwnerProfileLookup(records),
    [records],
  )

  const toFlagRows = (employees: EmployeeGoalStatus[]): FlagPersonRow[] =>
    employees.map((e) => employeeToFlagPersonRow(e, ownerProfileLookup))

  const pendingManagerRows = useMemo(
    () =>
      buildManagersPendingApproval(goals, records, cycleFilter || null).map((row) =>
        managerPendingToFlagPersonRow(row, ownerProfileLookup),
      ),
    [goals, records, cycleFilter, ownerProfileLookup],
  )

  const devRows = ratingSummary.devOrUnsatisfactory

  const devFilterOptions = useMemo(() => {
    const departments = new Set<string>()
    const cycles = new Set<string>()
    const ratings = new Set<string>()
    for (const row of devRows) {
      if (row.department) departments.add(row.department)
      if (row.cycleName) cycles.add(row.cycleName)
      if (row.displayGrade) ratings.add(row.displayGrade)
    }
    return {
      departments: [...departments].sort(),
      cycles: [...cycles].sort(),
      ratings: [...ratings].sort(),
    }
  }, [devRows])

  const filteredDevRows = useMemo(() => {
    const q = devSearch.trim().toLowerCase()
    return devRows.filter((row) => {
      if (devDeptFilter && row.department !== devDeptFilter) return false
      if (devCycleFilter && row.cycleName !== devCycleFilter) return false
      if (devRatingFilter && row.displayGrade !== devRatingFilter) return false
      if (!q) return true
      const hay = [row.employeeName, row.employeeId, row.department, row.cycleName, row.displayGrade]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [devRows, devSearch, devDeptFilter, devCycleFilter, devRatingFilter])

  useEffect(() => {
    setDevPage(1)
  }, [devSearch, devDeptFilter, devCycleFilter, devRatingFilter, perfCycleFilter])

  const devPagination = useMemo(
    () => paginate(filteredDevRows, devPage, DEV_PERFORMERS_PAGE_SIZE),
    [filteredDevRows, devPage],
  )

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

  if (goalsLoading || perfLoading) return <LoadingState />

  return (
    <div className="pd-page">
      <header className="pd-page-header">
        <div>
          <h1 className="pd-page-title">Monitoring</h1>
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

      {(goalsError || perfError) && <div className="pd-alert">{goalsError ?? perfError}</div>}
      {uploadMessage && <p className="pd-page-subtitle">{uploadMessage}</p>}

      {goals.length > 0 || records.length > 0 ? (
        <div className="pd-filter-bar" style={{ marginBottom: '1rem' }} aria-label="Filters">
          <div className="pd-form-row">
            <label className="pd-label" htmlFor="goals-cycle-filter">
              Goals cycle
            </label>
            <select
              id="goals-cycle-filter"
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
            <label className="pd-label" htmlFor="calendar-quarter-filter">
              Calendar quarter
            </label>
            <select
              id="calendar-quarter-filter"
              className="pd-select"
              value={calendarQuarter ?? ''}
              onChange={(e) => {
                const value = e.target.value
                setCalendarQuarter(value === '' ? null : (Number(value) as CalendarQuarter))
              }}
            >
              <option value="">All</option>
              {CALENDAR_QUARTERS.map((q) => (
                <option key={q.quarter} value={q.quarter}>
                  {q.label}
                </option>
              ))}
            </select>
          </div>
          {quarterSelected && (
            <div className="pd-form-row">
              <label className="pd-label" htmlFor="calendar-year-filter">
                Year
              </label>
              <select
                id="calendar-year-filter"
                className="pd-select"
                value={calendarYear}
                onChange={(e) => setCalendarYear(Number(e.target.value))}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="pd-form-row">
            <label className="pd-label" htmlFor="ratings-cycle-filter">
              Ratings cycle
            </label>
            <select
              id="ratings-cycle-filter"
              className="pd-select"
              value={perfCycleFilter}
              onChange={(e) => setPerfCycleFilter(e.target.value)}
            >
              <option value="">All cycles</option>
              {perfCycles.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <div className="pd-page-main">
          {goals.length === 0 ? (
            <EmptyState
              title="No goals loaded"
              description="Upload your Revolut Goals CSV export (Performance → Goals → All Details) using Upload CSV above."
            />
          ) : (
            <>
          <Section title="Goal submission & approval">
            <div className="pd-stat-grid">
              <StatCard
                label="Goal submission rate"
                value={`${goalsSummary.submissionRatePct}%`}
                hint={`${goalsSummary.totalOwners} employees`}
                labelHelp={GOALS_METRIC_HELP.submissionRate}
              />
              <StatCard
                label="Goal approval rate"
                value={`${goalsSummary.approvalRatePct}%`}
                labelHelp={GOALS_METRIC_HELP.approvalRate}
              />
              <StatCard
                label="Progress update rate"
                value={`${goalsSummary.progressUpdateRatePct}%`}
                labelHelp={GOALS_METRIC_HELP.progressUpdateRate}
              />
            </div>

            <FlagPanelGrid>
              <FlagPanel
                title="Goals not submitted"
                emptyText="Everyone has submitted their employee goals."
                rows={toFlagRows(goalsSummary.notSubmitted)}
              />

              {goalsSummary.quarterDay != null && goalsSummary.quarterDay >= 15 && (
                <FlagPanel
                  title="Not submitted by Day 15"
                  emptyText="No one missing submission on Day 15."
                  rows={toFlagRows(goalsSummary.flagDay15NotSubmitted)}
                />
              )}

              {goalsSummary.quarterDay != null && goalsSummary.quarterDay >= 30 && (
                <FlagPanel
                  title="Not submitted by Day 30"
                  emptyText="No one missing submission on Day 30."
                  rows={toFlagRows(goalsSummary.flagDay30NotSubmitted)}
                />
              )}

              <FlagPanel
                title="Pending manager approval"
                emptyText="No goals waiting for manager approval."
                rows={pendingManagerRows}
                showPendingGoalCount
              />

              <FlagPanel
                title="No progress updates"
                emptyText="Everyone has updated actuals on their goals."
                rows={toFlagRows(goalsSummary.lowProgressUpdates)}
              />
            </FlagPanelGrid>
          </Section>

          <Section title="Check-in completion">
            {!quarterSelected ? (
              <p className="pd-page-subtitle">Select a calendar quarter to track check-ins.</p>
            ) : checkInSummary && checkInSummary.ownersWithPriorGoals === 0 ? (
              <p className="pd-page-subtitle">
                No individual employee goals tagged {checkInSummary.priorQuarterLabel} in the
                export.
              </p>
            ) : (
              checkInSummary && (
                <CheckInCompletionPanel
                  summary={checkInSummary}
                  ownerProfileLookup={ownerProfileLookup}
                />
              )
            )}
          </Section>

          <Section title="Rating distribution">
            {ratingSummary.totalRated === 0 ? (
              <p className="pd-page-subtitle">
                No rated scorecards for this cycle. Sync performance data or pick another cycle.
              </p>
            ) : (
              <RatingDistributionPanel
                distribution={ratingSummary.distribution}
                outlierDepartments={ratingSummary.outlierDepartments}
              />
            )}
          </Section>

          <section className="pd-section pd-section--compact">
            <h2 className="pd-section-title">Developing/unsatisfactory performers</h2>
            {devRows.length === 0 ? (
              <p className="pd-page-subtitle">None in scope.</p>
            ) : (
              <div className="pd-panel pd-dev-performers">
                <div className="pd-filter-bar pd-dev-performers-filters">
                  <div className="pd-form-row">
                    <label className="pd-label" htmlFor="dev-unsat-search">
                      Search
                    </label>
                    <input
                      id="dev-unsat-search"
                      className="pd-input"
                      placeholder="Employee, department, cycle…"
                      value={devSearch}
                      onChange={(e) => setDevSearch(e.target.value)}
                    />
                  </div>
                  <div className="pd-form-row">
                    <label className="pd-label" htmlFor="dev-unsat-dept">
                      Department
                    </label>
                    <select
                      id="dev-unsat-dept"
                      className="pd-select"
                      value={devDeptFilter}
                      onChange={(e) => setDevDeptFilter(e.target.value)}
                    >
                      <option value="">All</option>
                      {devFilterOptions.departments.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pd-form-row">
                    <label className="pd-label" htmlFor="dev-unsat-cycle">
                      Cycle
                    </label>
                    <select
                      id="dev-unsat-cycle"
                      className="pd-select"
                      value={devCycleFilter}
                      onChange={(e) => setDevCycleFilter(e.target.value)}
                    >
                      <option value="">All</option>
                      {devFilterOptions.cycles.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pd-form-row">
                    <label className="pd-label" htmlFor="dev-unsat-rating">
                      Rating
                    </label>
                    <select
                      id="dev-unsat-rating"
                      className="pd-select"
                      value={devRatingFilter}
                      onChange={(e) => setDevRatingFilter(e.target.value)}
                    >
                      <option value="">All</option>
                      {devFilterOptions.ratings.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {filteredDevRows.length === 0 ? (
                  <p className="pd-page-subtitle pd-dev-performers-empty">
                    No employees match the current filters.
                  </p>
                ) : (
                  <>
                    <div className="pd-table-wrap pd-dev-performers-table">
                      <table className="pd-table">
                        <thead>
                          <tr>
                            <th>Employee</th>
                            <th>Department</th>
                            <th>Cycle</th>
                            <th>Rating</th>
                          </tr>
                        </thead>
                        <tbody>
                          {devPagination.items.map((r, i) => (
                            <tr key={`${r.employeeId}-${devPagination.startIndex + i}`}>
                              <td>{r.employeeName ?? r.employeeId ?? '—'}</td>
                              <td>{r.department ?? '—'}</td>
                              <td>{r.cycleName ?? '—'}</td>
                              <td>
                                <span className="pd-badge pd-badge-warn">{r.displayGrade}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <TablePagination
                      page={devPagination.page}
                      totalPages={devPagination.totalPages}
                      totalItems={devPagination.totalItems}
                      startIndex={devPagination.startIndex}
                      endIndex={devPagination.endIndex}
                      onPageChange={setDevPage}
                    />
                  </>
                )}
              </div>
            )}
          </section>
            </>
          )}
      </div>
    </div>
  )
}
