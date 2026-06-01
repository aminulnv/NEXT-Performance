import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGoalsData } from '@/hooks/useGoalsData'
import { useEmployeesDirectory } from '@/hooks/useEmployeesDirectory'
import { usePerformanceData } from '@/hooks/usePerformanceData'
import { filterActiveEmployees } from '@/lib/activeEmployees'
import { GoalsCsvUpload } from '@/components/goals/GoalsCsvUpload'
import { LoadingState } from '@/components/performance/LoadingState'
import { EmptyState } from '@/components/performance/EmptyState'
import { StatCard } from '@/components/performance/StatCard'
import { paginate, TablePagination } from '@/components/performance/TablePagination'
import { ScrollableTableViewport } from '@/components/performance/ScrollableTableViewport'
import { RatingDistributionPanel } from '@/components/performance/RatingDistributionPanel'
import {
  CALENDAR_QUARTERS,
  currentCalendarQuarter,
  currentCalendarYear,
  formatQuarterYear,
  quarterHasStarted,
  quarterStartDate,
  type CalendarQuarter,
} from '@/lib/calendarQuarters'
import { CheckInCompletionPanel } from '@/components/goals/CheckInCompletionPanel'
import {
  buildCheckInCompletionSummary,
  buildGoalsMonitoringSummary,
  buildManagersPendingApproval,
  buildRatingMonitoringSummary,
  goalMatchesReviewCycle,
  uniqueReviewCycles,
} from '@/lib/goalsMonitoring'
import { GOALS_METRIC_HELP } from '@/lib/goalsMetricHelp'
import {
  buildGoalOwnerProfileLookup,
  enrichGoalOwnerProfileLookup,
  employeeToFlagPersonRow,
  managerPendingToFlagPersonRow,
  managerTeamToFlagPersonRow,
} from '@/lib/goalOwnerProfiles'
import type { EmployeeGoalStatus, GoalBreakdownRow } from '@/lib/goalsMonitoring'
import { PersonAvatar } from '@/components/performance/PersonAvatar'
import { uniqueFieldValues } from '@/lib/metrics'
import { personGoalsSearchUrl } from '@/lib/goalsFilters'
import type { FlagPersonRow } from '@/lib/goalOwnerProfiles'
import '@/styles/performance.css'

function rowGoalsPath(row: FlagPersonRow): string | null {
  return personGoalsSearchUrl(row.name)
}

function PersonWithAvatar({
  name,
  avatarUrl,
  size = 32,
  muted = false,
}: {
  name: string
  avatarUrl: string | null
  size?: number
  muted?: boolean
}) {
  return (
    <span className={`pd-flag-person${muted ? ' pd-flag-person--muted' : ''}`}>
      <PersonAvatar name={name} avatarUrl={avatarUrl} size={size} />
      <span className="pd-flag-person__label">{name}</span>
    </span>
  )
}

const DEV_PERFORMERS_PAGE_SIZE = 10

type SubmissionDayThreshold = 10 | 15 | 30

const SUBMISSION_DAY_OPTIONS: { value: SubmissionDayThreshold; label: string }[] = [
  { value: 10, label: 'Day 10' },
  { value: 15, label: 'Day 15' },
  { value: 30, label: 'Day 30' },
]

function FutureQuarterNotice({
  quarter,
  year,
}: {
  quarter: CalendarQuarter
  year: number
}) {
  const label = formatQuarterYear(quarter, year)
  const start = quarterStartDate(year, quarter)
  const startLabel = new Date(`${start}T12:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const now = new Date()
  const currentLabel = formatQuarterYear(currentCalendarQuarter(now), currentCalendarYear(now))

  return (
    <EmptyState
      title={`${label} has not started yet`}
      description={`Goal monitoring for ${label} opens on ${startLabel}. Select ${currentLabel} (or an earlier quarter) to track submissions and deadlines.`}
    />
  )
}

function defaultSubmissionDayThreshold(quarterDay: number | null): SubmissionDayThreshold {
  if (quarterDay == null || quarterDay < 10) return 10
  if (quarterDay >= 30) return 30
  if (quarterDay >= 15) return 15
  return 10
}

function NotSubmittedByDayPanel({
  quarterSelected,
  quarterDay,
  rows,
}: {
  quarterSelected: boolean
  quarterDay: number | null
  rows: FlagPersonRow[]
}) {
  const navigate = useNavigate()
  const [dayThreshold, setDayThreshold] = useState<SubmissionDayThreshold>(() =>
    defaultSubmissionDayThreshold(quarterDay),
  )

  useEffect(() => {
    setDayThreshold(defaultSubmissionDayThreshold(quarterDay))
  }, [quarterDay])

  const pastThreshold = quarterDay != null && quarterDay >= dayThreshold
  const listTitle = `Not submitted by Day ${dayThreshold}`

  return (
    <Panel title="Not submitted by day">
      {!quarterSelected ? (
        <p className="pd-page-subtitle" style={{ margin: 0 }}>
          Select a calendar quarter to track Day 10, 15, and 30 submission deadlines.
        </p>
      ) : (
        <>
          <div className="pd-flag-panel-toolbar">
            <div
              className="pd-view-toggle"
              role="tablist"
              aria-label="Submission deadline"
            >
              {SUBMISSION_DAY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={dayThreshold === option.value}
                  className={`pd-view-toggle__btn${
                    dayThreshold === option.value ? ' pd-view-toggle__btn--active' : ''
                  }`}
                  onClick={() => setDayThreshold(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {quarterDay != null && (
              <p className="pd-flag-panel-toolbar__hint pd-muted">
                Calendar quarter day {quarterDay}
                {!pastThreshold && ` · Day ${dayThreshold} not reached yet`}
              </p>
            )}
          </div>

          {!pastThreshold ? (
            <p className="pd-page-subtitle" style={{ margin: 0 }}>
              This list activates on Day {dayThreshold} of the selected quarter.
            </p>
          ) : rows.length === 0 ? (
            <p className="pd-page-subtitle" style={{ margin: 0 }}>
              No one missing submission by Day {dayThreshold}.
            </p>
          ) : (
            <ScrollableTableViewport label={listTitle}>
              <table className="pd-flag-people-table pd-flag-people-table--auto-cols">
                <colgroup>
                  <col className="pd-flag-people-table__col-avatar" />
                  <col className="pd-flag-people-table__col-name" />
                  <col className="pd-flag-people-table__col-manager" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="pd-flag-people-table__avatar-col" scope="col">
                      <span className="pd-sr-only">Avatar</span>
                    </th>
                    <th scope="col">Name</th>
                    <th scope="col">Manager</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const detailPath = rowGoalsPath(row)
                    return (
                      <tr
                        key={row.id}
                        className={detailPath ? 'pd-table-row--clickable' : undefined}
                        onClick={detailPath ? () => navigate(detailPath) : undefined}
                      >
                        <td className="pd-flag-people-table__avatar-col">
                          <PersonAvatar name={row.name} avatarUrl={row.avatarUrl} size={32} />
                        </td>
                        <td className="pd-flag-people-table__name">
                          <span className="pd-flag-people-table__name-text">{row.name}</span>
                          {row.department && (
                            <span className="pd-flag-people-table__dept-sub">{row.department}</span>
                          )}
                        </td>
                        <td className="pd-flag-people-table__manager">
                          {row.managerName === '—' ? (
                            <span className="pd-muted">—</span>
                          ) : (
                            <PersonWithAvatar
                              name={row.managerName}
                              avatarUrl={row.managerAvatarUrl}
                              size={24}
                              muted
                            />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </ScrollableTableViewport>
          )}
        </>
      )}
    </Panel>
  )
}

function FlagPanel({
  title,
  rows,
  emptyText,
  showManagerName = false,
  showSubmittedGoalCount = false,
  showPendingGoalCount = false,
  showTeamSize = false,
  showOldestPendingDays = false,
}: {
  title: string
  rows: FlagPersonRow[]
  emptyText: string
  showManagerName?: boolean
  showSubmittedGoalCount?: boolean
  showPendingGoalCount?: boolean
  showTeamSize?: boolean
  showOldestPendingDays?: boolean
}) {
  const navigate = useNavigate()
  const autoColumns = showManagerName || showSubmittedGoalCount

  return (
    <Panel title={title}>
      {rows.length === 0 ? (
        <p className="pd-page-subtitle" style={{ margin: 0 }}>
          {emptyText}
        </p>
      ) : (
        <ScrollableTableViewport label={title}>
          <table
            className={`pd-flag-people-table${
              autoColumns ? ' pd-flag-people-table--auto-cols' : ''
            }`}
          >
            {autoColumns && (
              <colgroup>
                <col className="pd-flag-people-table__col-avatar" />
                <col className="pd-flag-people-table__col-name" />
                {showManagerName && <col className="pd-flag-people-table__col-manager" />}
                {showSubmittedGoalCount && (
                  <col className="pd-flag-people-table__col-count" />
                )}
              </colgroup>
            )}
            <thead>
              <tr>
                <th className="pd-flag-people-table__avatar-col" scope="col">
                  <span className="pd-sr-only">Avatar</span>
                </th>
                <th scope="col">Name</th>
                {showManagerName && <th scope="col">Manager</th>}
                {showSubmittedGoalCount && (
                  <th className="pd-flag-people-table__count-col" scope="col">
                    Count
                  </th>
                )}
                {showTeamSize && <th scope="col">Team size</th>}
                {showPendingGoalCount && <th scope="col">Pending goals</th>}
                {showOldestPendingDays && <th scope="col">Oldest pending (days)</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const detailPath = rowGoalsPath(row)
                return (
                  <tr
                    key={row.id}
                    className={detailPath ? 'pd-table-row--clickable' : undefined}
                    onClick={detailPath ? () => navigate(detailPath) : undefined}
                  >
                    <td className="pd-flag-people-table__avatar-col">
                      <PersonAvatar name={row.name} avatarUrl={row.avatarUrl} size={32} />
                    </td>
                    <td className="pd-flag-people-table__name">
                      <span className="pd-flag-people-table__name-text">{row.name}</span>
                      {row.department && (
                        <span className="pd-flag-people-table__dept-sub">{row.department}</span>
                      )}
                    </td>
                    {showManagerName && (
                      <td className="pd-flag-people-table__manager">
                        {row.managerName === '—' ? (
                          <span className="pd-muted">—</span>
                        ) : (
                          <PersonWithAvatar
                            name={row.managerName}
                            avatarUrl={row.managerAvatarUrl}
                            size={24}
                            muted
                          />
                        )}
                      </td>
                    )}
                    {showSubmittedGoalCount && (
                      <td className="pd-flag-people-table__count pd-flag-people-table__count-col">
                        {row.submittedGoalCount ?? 0}
                      </td>
                    )}
                    {showTeamSize && (
                      <td className="pd-flag-people-table__count">{row.teamSize ?? 0}</td>
                    )}
                    {showPendingGoalCount && (
                      <td className="pd-flag-people-table__count">{row.pendingGoalCount ?? 0}</td>
                    )}
                    {showOldestPendingDays && (
                      <td className="pd-flag-people-table__count">
                        {row.oldestPendingDays != null ? row.oldestPendingDays : '—'}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScrollableTableViewport>
      )}
    </Panel>
  )
}

function SubmissionBreakdownTable({
  title,
  rows,
  showRowAvatar = false,
}: {
  title: string
  rows: GoalBreakdownRow[]
  showRowAvatar?: boolean
}) {
  return (
    <Panel title={title}>
      {rows.length === 0 ? (
        <p className="pd-page-subtitle" style={{ margin: 0 }}>
          No data for this breakdown.
        </p>
      ) : (
        <ScrollableTableViewport label={title}>
          <table className="pd-table pd-table--compact">
            <thead>
              <tr>
                <th>Group</th>
                <th>Employees</th>
                <th>Submitted</th>
                <th>Not started</th>
                <th>Awaiting approval</th>
                <th>Approved</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>
                    {showRowAvatar ? (
                      <PersonWithAvatar
                        name={row.label}
                        avatarUrl={row.avatarUrl ?? null}
                        size={24}
                      />
                    ) : (
                      row.label
                    )}
                  </td>
                  <td>{row.totalEmployees}</td>
                  <td>
                    {row.submittedCount} ({row.submittedPct}%)
                  </td>
                  <td>{row.pendingSubmissionCount}</td>
                  <td>{row.awaitingApprovalCount}</td>
                  <td>{row.approvedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTableViewport>
      )}
    </Panel>
  )
}

type LowSubmissionDepartment = {
  department: string
  totalEmployees: number
  submissionPct: number
}

function LowSubmissionDepartmentsPanel({ rows }: { rows: LowSubmissionDepartment[] }) {
  const title = 'Departments below 60% submission'

  return (
    <Panel title={title}>
      {rows.length === 0 ? (
        <p className="pd-page-subtitle" style={{ margin: 0 }}>
          All departments with 3+ employees are at or above 60% submission.
        </p>
      ) : (
        <ScrollableTableViewport label={title}>
          <table className="pd-table pd-table--compact">
            <thead>
              <tr>
                <th>Department</th>
                <th>Employees</th>
                <th>Submission rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.department}>
                  <td>{row.department}</td>
                  <td>{row.totalEmployees}</td>
                  <td>{row.submissionPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTableViewport>
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
  const {
    employees: directoryEmployees,
    loading: employeesLoading,
    error: employeesError,
  } = useEmployeesDirectory()

  const activeRoster = useMemo(
    () => filterActiveEmployees(directoryEmployees),
    [directoryEmployees],
  )

  const goalCycles = useMemo(() => uniqueReviewCycles(goals), [goals])
  const perfCycles = useMemo(() => uniqueFieldValues(records, 'cycle_name'), [records])
  const reviewCycles = useMemo(() => {
    const cycles = new Set<string>()
    for (const cycle of perfCycles) cycles.add(cycle)
    for (const cycle of goalCycles) cycles.add(cycle)
    return [...cycles].sort((a, b) => a.localeCompare(b))
  }, [perfCycles, goalCycles])

  const [reviewCycleFilter, setReviewCycleFilter] = useState('')
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

  const selectedQuarterStarted =
    !quarterSelected ||
    calendarQuarter == null ||
    quarterHasStarted(calendarYear, calendarQuarter)

  const yearOptions = useMemo(() => {
    const y = currentCalendarYear()
    return [y - 1, y, y + 1]
  }, [])

  const ownerProfileLookup = useMemo(
    () =>
      enrichGoalOwnerProfileLookup(
        buildGoalOwnerProfileLookup(records),
        directoryEmployees,
      ),
    [records, directoryEmployees],
  )

  const selectedCycleHasGoals = useMemo(() => {
    if (!reviewCycleFilter) return true
    return goals.some((goal) => goalMatchesReviewCycle(goal, reviewCycleFilter))
  }, [reviewCycleFilter, goals])

  const goalsSummary = useMemo(
    () =>
      buildGoalsMonitoringSummary(goals, {
        cycleFilter: reviewCycleFilter || null,
        calendarQuarter: quarterSelected ? calendarQuarter : null,
        calendarYear: quarterSelected ? calendarYear : null,
        performanceRecords: records,
        ownerProfileLookup,
        activeRoster,
      }),
    [
      goals,
      records,
      reviewCycleFilter,
      calendarQuarter,
      calendarYear,
      quarterSelected,
      ownerProfileLookup,
      activeRoster,
    ],
  )

  const checkInSummary = useMemo(() => {
    if (!quarterSelected || calendarQuarter == null) return null
    return buildCheckInCompletionSummary(goals, {
      monitoringQuarter: calendarQuarter,
      monitoringYear: calendarYear,
    })
  }, [goals, calendarQuarter, calendarYear, quarterSelected])

  const ratingSummary = useMemo(
    () => buildRatingMonitoringSummary(records, reviewCycleFilter || null),
    [records, reviewCycleFilter],
  )

  const toFlagRows = (employees: EmployeeGoalStatus[]): FlagPersonRow[] =>
    employees.map((e) => employeeToFlagPersonRow(e, ownerProfileLookup))

  const pendingManagerRows = useMemo(
    () =>
      buildManagersPendingApproval(goals, records, reviewCycleFilter || null).map((row) =>
        managerPendingToFlagPersonRow(row, ownerProfileLookup),
      ),
    [goals, records, reviewCycleFilter, ownerProfileLookup],
  )

  const managersZeroSubmittedRows = useMemo(
    () =>
      goalsSummary.managerCompliance.managersZeroTeamSubmitted.map((row) =>
        managerTeamToFlagPersonRow(row, ownerProfileLookup),
      ),
    [goalsSummary.managerCompliance.managersZeroTeamSubmitted, ownerProfileLookup],
  )

  const managersPendingOver5DaysRows = useMemo(
    () =>
      goalsSummary.managerCompliance.managersPendingOver5Days.map((row) =>
        managerTeamToFlagPersonRow(row, ownerProfileLookup),
      ),
    [goalsSummary.managerCompliance.managersPendingOver5Days, ownerProfileLookup],
  )

  const counts = goalsSummary.submissionCounts
  const managerCompliance = goalsSummary.managerCompliance

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
  }, [devSearch, devDeptFilter, devCycleFilter, devRatingFilter, reviewCycleFilter])

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

  if (goalsLoading || perfLoading || employeesLoading) return <LoadingState />

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

      {(goalsError || perfError || employeesError) && (
        <div className="pd-alert">{goalsError ?? perfError ?? employeesError}</div>
      )}
      {uploadMessage && <p className="pd-page-subtitle">{uploadMessage}</p>}

      {goals.length > 0 || records.length > 0 ? (
        <div
          className="pd-filter-bar pd-filter-bar--compact"
          style={{ marginBottom: '1rem' }}
          aria-label="Filters"
        >
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
            <label className="pd-label" htmlFor="review-cycle-filter">
              Review cycle
            </label>
            <select
              id="review-cycle-filter"
              className="pd-select"
              value={reviewCycleFilter}
              onChange={(e) => setReviewCycleFilter(e.target.value)}
            >
              <option value="">All cycles</option>
              {reviewCycles.map((c) => (
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
          ) : activeRoster.length === 0 ? (
            <EmptyState
              title="No active employees in directory"
              description="Sync the employee directory from Organization → People so monitoring uses the full active headcount as the denominator."
            />
          ) : (
            <>
              {!selectedQuarterStarted && calendarQuarter != null ? (
                <FutureQuarterNotice quarter={calendarQuarter} year={calendarYear} />
              ) : reviewCycleFilter && !selectedCycleHasGoals ? (
                <EmptyState
                  title="No goals found"
                  description={`No employee goals were exported for ${reviewCycleFilter}. Upload an updated Goals CSV or choose another review cycle.`}
                />
              ) : (
                <>
          <Section title="Goal submission & approval">
            <div className="pd-stat-grid">
              <StatCard
                label="Total employees"
                value={goalsSummary.totalOwners}
                hint="Active · People directory"
                labelHelp={GOALS_METRIC_HELP.totalEmployees}
              />
              <StatCard
                label="Goals submitted"
                count={counts.submitted.count}
                pct={counts.submitted.pct}
                showProgress
                accent="success"
                labelHelp={GOALS_METRIC_HELP.submissionRate}
              />
              <StatCard
                label="Pending submission"
                count={counts.pendingSubmission.count}
                pct={counts.pendingSubmission.pct}
                accent="warning"
                labelHelp={GOALS_METRIC_HELP.pendingSubmission}
              />
              <StatCard
                label="Awaiting approval"
                count={counts.awaitingApproval.count}
                pct={counts.awaitingApproval.pct}
                accent="info"
                labelHelp={GOALS_METRIC_HELP.awaitingApproval}
              />
              <StatCard
                label="Approved & locked"
                count={counts.approvedLocked.count}
                pct={counts.approvedLocked.pct}
                showProgress
                accent="success"
                labelHelp={GOALS_METRIC_HELP.approvedLocked}
              />
              {goalsSummary.quarterDay != null && goalsSummary.quarterDay >= 30 && (
                <StatCard
                  label="Overdue (Day 30+)"
                  count={counts.overdueDay30NotApproved.count}
                  pct={counts.overdueDay30NotApproved.pct}
                  accent="danger"
                  labelHelp={GOALS_METRIC_HELP.overdueDay30}
                />
              )}
              <StatCard
                label="Progress update rate"
                pct={goalsSummary.progressUpdateRatePct}
                labelHelp={GOALS_METRIC_HELP.progressUpdateRate}
              />
            </div>

            <FlagPanelGrid>
              <FlagPanel
                title="Goals submitted"
                emptyText="No one has submitted employee goals yet."
                rows={toFlagRows(goalsSummary.submitted)}
                showManagerName
                showSubmittedGoalCount
              />

              <FlagPanel
                title="Goals not submitted"
                emptyText="Everyone has submitted their employee goals."
                rows={toFlagRows(goalsSummary.notSubmitted)}
                showManagerName
              />

              <FlagPanel
                title="Awaiting manager approval"
                emptyText="No employees waiting on manager approval."
                rows={toFlagRows(goalsSummary.awaitingApproval)}
                showManagerName
              />

              <FlagPanel
                title="Approved & locked"
                emptyText="No fully approved employees yet."
                rows={toFlagRows(goalsSummary.approvedLocked)}
                showManagerName
              />

              <NotSubmittedByDayPanel
                quarterSelected={quarterSelected}
                quarterDay={goalsSummary.quarterDay}
                rows={toFlagRows(goalsSummary.notSubmitted)}
              />

              {goalsSummary.quarterDay != null && goalsSummary.quarterDay >= 30 && (
                <FlagPanel
                  title="Overdue — submitted but not approved (Day 30+)"
                  emptyText="No overdue approvals."
                  rows={toFlagRows(goalsSummary.overdueDay30NotApproved)}
                  showManagerName
                  showSubmittedGoalCount
                />
              )}

              <FlagPanel
                title="Pending manager approval (by manager)"
                emptyText="No goals waiting for manager approval."
                rows={pendingManagerRows}
                showPendingGoalCount
              />

              <FlagPanel
                title="No progress updates"
                emptyText="Everyone has updated actuals on their goals."
                rows={toFlagRows(goalsSummary.lowProgressUpdates)}
                showManagerName
                showSubmittedGoalCount
              />
            </FlagPanelGrid>
          </Section>

          <Section title="Manager compliance">
            <div className="pd-stat-grid">
              <StatCard
                label="Managers with team approved"
                value={`${managerCompliance.managersAllTeamApprovedPct}%`}
                hint={`${managerCompliance.managersAllTeamApprovedCount} of ${managerCompliance.managersWithSubmittedTeam} managers`}
                labelHelp={GOALS_METRIC_HELP.managerApprovalCompliance}
              />
              <StatCard
                label="Avg submission → approval"
                value={
                  managerCompliance.avgDaysSubmissionToApproval != null
                    ? `${managerCompliance.avgDaysSubmissionToApproval} days`
                    : '—'
                }
                hint={
                  managerCompliance.avgDaysSubmissionToApproval == null
                    ? 'Add Submitted Date & Approval Date to goals export'
                    : undefined
                }
                labelHelp={GOALS_METRIC_HELP.avgApprovalTime}
              />
              <StatCard
                label="Managers — zero team submitted"
                value={managerCompliance.managersZeroTeamSubmitted.length}
              />
              <StatCard
                label="Managers — pending &gt;5 days"
                value={managerCompliance.managersPendingOver5Days.length}
              />
            </div>

            <FlagPanelGrid>
              <FlagPanel
                title="Managers with 0 team goals submitted"
                emptyText="Every manager has at least one submitted direct report."
                rows={managersZeroSubmittedRows}
                showTeamSize
              />
              <FlagPanel
                title="Managers with pending approvals &gt;5 days"
                emptyText="No managers with stale pending approvals."
                rows={managersPendingOver5DaysRows}
                showPendingGoalCount
                showOldestPendingDays
              />
            </FlagPanelGrid>
          </Section>

          <Section title="Breakdown">
            <FlagPanelGrid>
              <SubmissionBreakdownTable
                title="By department"
                rows={goalsSummary.breakdownByDepartment}
              />
              <SubmissionBreakdownTable
                title="By location"
                rows={goalsSummary.breakdownByLocation}
              />
              <SubmissionBreakdownTable
                title="By manager"
                rows={goalsSummary.breakdownByManager}
                showRowAvatar
              />
            </FlagPanelGrid>
          </Section>

          <Section title="Quality signals">
            <FlagPanelGrid>
              <FlagPanel
                title="Wrong goal count (&lt;3 or &gt;5 submitted)"
                emptyText="All submitted employees have 3–5 goals."
                rows={toFlagRows(goalsSummary.qualityWrongGoalCount)}
                showManagerName
                showSubmittedGoalCount
              />
              <LowSubmissionDepartmentsPanel rows={goalsSummary.lowSubmissionDepartments} />
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
                </>
              )}

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
