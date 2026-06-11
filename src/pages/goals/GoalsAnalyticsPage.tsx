import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useGoalsData } from '@/hooks/useGoalsData'
import { useEmployeesDirectory } from '@/hooks/useEmployeesDirectory'
import { usePerformanceData } from '@/hooks/usePerformanceData'
import { filterActiveEmployees } from '@/lib/activeEmployees'
import { GoalsCsvUpload } from '@/components/goals/GoalsCsvUpload'
import { LoadingState } from '@/components/performance/LoadingState'
import { EmptyState } from '@/components/performance/EmptyState'
import { FilterMultiSelect } from '@/components/performance/FilterMultiSelect'
import { StatCard } from '@/components/performance/StatCard'
import { ScrollableTableViewport } from '@/components/performance/ScrollableTableViewport'
import {
  CALENDAR_QUARTERS,
  currentCalendarQuarter,
  currentCalendarYear,
  formatQuarterYear,
  quarterHasStarted,
  quarterStartDate,
  reviewCyclesMatch,
  type CalendarQuarter,
} from '@/lib/calendarQuarters'
import { CheckInCompletionPanel } from '@/components/goals/CheckInCompletionPanel'
import { GoalSubmissionStatGrid } from '@/components/goals/GoalSubmissionStatGrid'
import {
  buildCheckInCompletionSummary,
  buildGoalsMonitoringSummary,
  buildManagersPendingApproval,
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
  resolveDirectoryEmployeeCountry,
  sortMonitoringCountryLabels,
} from '@/lib/goalOwnerProfiles'
import type { EmployeeGoalStatus, GoalBreakdownRow } from '@/lib/goalsMonitoring'
import { PersonAvatar } from '@/components/performance/PersonAvatar'
import { uniqueFieldValues } from '@/lib/metrics'
import { allGoalsDetailsUrl, personGoalsSearchUrl } from '@/lib/goalsFilters'
import { canAccessPerformanceData, getRoleDefinition, roleUsesDepartmentScope } from '@/lib/permissions'
import type { FlagPersonRow, GoalOwnerProfileLookup } from '@/lib/goalOwnerProfiles'
import type { EmployeeDirectoryEntry } from '@/types/employee'
import '@/styles/performance.css'

type RosterFilterState = {
  departments: string[]
  teams: string[]
  countries: string[]
}

type RosterFilterSkip = {
  department?: boolean
  team?: boolean
  country?: boolean
}

function employeeMatchesRosterFilters(
  employee: EmployeeDirectoryEntry,
  filters: RosterFilterState,
  ownerProfileLookup: GoalOwnerProfileLookup,
  skip: RosterFilterSkip = {},
): boolean {
  if (!skip.department && filters.departments.length > 0) {
    const department = employee.department?.trim()
    if (!department || !filters.departments.includes(department)) return false
  }
  if (!skip.team && filters.teams.length > 0) {
    const teamKey = rosterTeamKey(employee)
    if (!teamKey || !filters.teams.includes(teamKey)) return false
  }
  if (!skip.country && filters.countries.length > 0) {
    if (
      !filters.countries.includes(
        resolveDirectoryEmployeeCountry(employee, ownerProfileLookup),
      )
    ) {
      return false
    }
  }
  return true
}

function rosterForFilterOptions(
  roster: EmployeeDirectoryEntry[],
  filters: RosterFilterState,
  ownerProfileLookup: GoalOwnerProfileLookup,
  skip: RosterFilterSkip,
): EmployeeDirectoryEntry[] {
  const appliesOtherFilters =
    (!skip.department && filters.departments.length > 0) ||
    (!skip.team && filters.teams.length > 0) ||
    (!skip.country && filters.countries.length > 0)
  if (!appliesOtherFilters) return roster
  return roster.filter((employee) =>
    employeeMatchesRosterFilters(employee, filters, ownerProfileLookup, skip),
  )
}

function rowGoalsPath(row: FlagPersonRow): string | null {
  return personGoalsSearchUrl(row.name)
}

function filterFlagPersonRows(rows: FlagPersonRow[], query: string): FlagPersonRow[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((row) => {
    const hay = [row.name, row.department, row.managerName, row.employeeId]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
}

function filterBreakdownRows(rows: GoalBreakdownRow[], query: string): GoalBreakdownRow[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((row) => {
    const hay = [row.label, row.key].filter(Boolean).join(' ').toLowerCase()
    return hay.includes(q)
  })
}

function rosterTeamKey(employee: { department?: string | null; team?: string | null }): string | null {
  const team = employee.team?.trim()
  if (!team) return null
  const department = employee.department?.trim() || 'Unknown'
  return `${department}::${team}`
}

function rosterTeamLabel(employee: { department?: string | null; team?: string | null }): string {
  const team = employee.team?.trim()
  if (!team) return ''
  const department = employee.department?.trim()
  return department ? `${team} · ${department}` : team
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
  const searchInputId = useId()
  const [dayThreshold, setDayThreshold] = useState<SubmissionDayThreshold>(() =>
    defaultSubmissionDayThreshold(quarterDay),
  )
  const [search, setSearch] = useState('')

  useEffect(() => {
    setDayThreshold(defaultSubmissionDayThreshold(quarterDay))
  }, [quarterDay])

  const pastThreshold = quarterDay != null && quarterDay >= dayThreshold
  const listTitle = `Not submitted by Day ${dayThreshold}`
  const filteredRows = useMemo(() => filterFlagPersonRows(rows, search), [rows, search])
  const searchActive = search.trim().length > 0

  return (
    <Panel
      title="Not submitted by day"
      count={pastThreshold ? (searchActive ? filteredRows.length : rows.length) : undefined}
    >
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
            <>
              <div className="pd-flag-panel-search">
                <label className="pd-sr-only" htmlFor={searchInputId}>
                  Search {listTitle}
                </label>
                <input
                  id={searchInputId}
                  className="pd-input"
                  type="search"
                  placeholder="Search name, department, manager…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {filteredRows.length === 0 ? (
                <p className="pd-page-subtitle" style={{ margin: 0 }}>
                  No matches for your search.
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
                  {filteredRows.map((row) => {
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
  const searchInputId = useId()
  const [search, setSearch] = useState('')
  const autoColumns = showManagerName || showSubmittedGoalCount
  const filteredRows = useMemo(() => filterFlagPersonRows(rows, search), [rows, search])
  const searchActive = search.trim().length > 0

  return (
    <Panel title={title} count={searchActive ? filteredRows.length : rows.length}>
      {rows.length === 0 ? (
        <p className="pd-page-subtitle" style={{ margin: 0 }}>
          {emptyText}
        </p>
      ) : (
        <>
          <div className="pd-flag-panel-search">
            <label className="pd-sr-only" htmlFor={searchInputId}>
              Search {title}
            </label>
            <input
              id={searchInputId}
              className="pd-input"
              type="search"
              placeholder="Search name, department, manager…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {filteredRows.length === 0 ? (
            <p className="pd-page-subtitle" style={{ margin: 0 }}>
              No matches for your search.
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
              {filteredRows.map((row) => {
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
        </>
      )}
    </Panel>
  )
}

function SubmissionBreakdownTable({
  title,
  rows,
  showRowAvatar = false,
  className,
  searchPlaceholder = 'Search name, department, manager…',
}: {
  title: string
  rows: GoalBreakdownRow[]
  showRowAvatar?: boolean
  className?: string
  searchPlaceholder?: string
}) {
  const searchInputId = useId()
  const [search, setSearch] = useState('')
  const filteredRows = useMemo(() => filterBreakdownRows(rows, search), [rows, search])
  const searchActive = search.trim().length > 0

  return (
    <Panel
      title={title}
      count={searchActive ? filteredRows.length : rows.length}
      className={className}
    >
      {rows.length === 0 ? (
        <p className="pd-page-subtitle" style={{ margin: 0 }}>
          No data for this breakdown.
        </p>
      ) : (
        <>
          <div className="pd-flag-panel-search">
            <label className="pd-sr-only" htmlFor={searchInputId}>
              Search {title}
            </label>
            <input
              id={searchInputId}
              className="pd-input"
              type="search"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {filteredRows.length === 0 ? (
            <p className="pd-page-subtitle" style={{ margin: 0 }}>
              No matches for your search.
            </p>
          ) : (
            <ScrollableTableViewport label={title}>
              <table className="pd-table pd-table--compact pd-table--breakdown">
                <colgroup>
                  <col className="pd-breakdown-col__group" />
                  <col className="pd-breakdown-col__metric" />
                  <col className="pd-breakdown-col__metric" />
                  <col className="pd-breakdown-col__metric" />
                  <col className="pd-breakdown-col__metric" />
                  <col className="pd-breakdown-col__metric" />
                </colgroup>
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
                  {filteredRows.map((row) => (
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
        </>
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
    <Panel title={title} count={rows.length}>
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

function Panel({
  title,
  count,
  children,
  className,
}: {
  title: string
  count?: number
  children: ReactNode
  className?: string
}) {
  return (
    <div className={['pd-panel pd-flag-panel', className].filter(Boolean).join(' ')}>
      <h3 className="pd-panel-title">
        <span>{title}</span>
        {count != null ? (
          <span className="pd-panel-title__count">{count.toLocaleString()}</span>
        ) : null}
      </h3>
      {children}
    </div>
  )
}

function FlagPanelGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={className ? `pd-flag-grid ${className}` : 'pd-flag-grid'}>{children}</div>
}

function BreakdownPanelGrid({ children }: { children: ReactNode }) {
  return <div className="pd-breakdown-grid">{children}</div>
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
  children?: ReactNode
}) {
  return (
    <section className="pd-section" style={{ marginTop: '2rem' }}>
      {action ? (
        <div className="pd-section-header">
          <h2 className="pd-section-title">{title}</h2>
          {action}
        </div>
      ) : (
        <h2 className="pd-section-title">{title}</h2>
      )}
      {description && <p className="pd-section-desc">{description}</p>}
      {children}
    </section>
  )
}

export default function GoalsAnalyticsPage() {
  const { role, user } = useAuth()
  const canLoadPerformance = role ? canAccessPerformanceData(role) : false
  const canUploadGoals = role ? Boolean(getRoleDefinition(role)?.uploadGoals) : false
  const scopedDepartments = user?.scopedDepartments ?? null
  const hasDepartmentScope =
    Boolean(role && roleUsesDepartmentScope(role) && scopedDepartments?.length)
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
  const perfCycles = useMemo(
    () => (canLoadPerformance ? uniqueFieldValues(records, 'cycle_name') : []),
    [records, canLoadPerformance],
  )
  const reviewCycles = useMemo(() => {
    const cycles = new Set<string>()
    for (const cycle of goalCycles) cycles.add(cycle)
    if (canLoadPerformance) {
      for (const cycle of perfCycles) cycles.add(cycle)
    }
    return [...cycles].sort((a, b) => a.localeCompare(b))
  }, [perfCycles, goalCycles, canLoadPerformance])

  const [reviewCycleFilter, setReviewCycleFilter] = useState('Q2 2026')
  const [departmentFilter, setDepartmentFilter] = useState<string[]>([])
  const [teamFilter, setTeamFilter] = useState<string[]>([])
  const [countryFilter, setCountryFilter] = useState<string[]>([])
  const [calendarQuarter, setCalendarQuarter] = useState<CalendarQuarter | null>(2)
  const [calendarYear, setCalendarYear] = useState(2026)
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
        canLoadPerformance ? buildGoalOwnerProfileLookup(records) : { byEmployeeId: new Map(), byEmail: new Map() },
        directoryEmployees,
      ),
    [records, directoryEmployees, canLoadPerformance],
  )

  const rosterFilterState = useMemo(
    (): RosterFilterState => ({
      departments: departmentFilter,
      teams: teamFilter,
      countries: countryFilter,
    }),
    [departmentFilter, teamFilter, countryFilter],
  )

  const rosterFiltersActive =
    rosterFilterState.departments.length > 0 ||
    rosterFilterState.teams.length > 0 ||
    rosterFilterState.countries.length > 0

  function clearRosterFilters() {
    setDepartmentFilter([])
    setTeamFilter([])
    setCountryFilter([])
  }

  function onDepartmentFilterChange(next: string[]) {
    if (hasDepartmentScope && scopedDepartments?.length) {
      const allowed = new Set(scopedDepartments)
      setDepartmentFilter(next.filter((department) => allowed.has(department)))
      return
    }
    setDepartmentFilter(next)
  }

  const departmentOptions = useMemo(() => {
    if (hasDepartmentScope && scopedDepartments?.length) {
      return scopedDepartments.map((department) => ({ value: department, label: department }))
    }

    const roster = rosterForFilterOptions(
      activeRoster,
      rosterFilterState,
      ownerProfileLookup,
      { department: true },
    )
    const departments = new Set<string>()
    for (const employee of roster) {
      const department = employee.department?.trim()
      if (department) departments.add(department)
    }
    return [...departments]
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map((department) => ({ value: department, label: department }))
  }, [activeRoster, rosterFilterState, ownerProfileLookup, hasDepartmentScope, scopedDepartments])

  const teamOptions = useMemo(() => {
    const roster = rosterForFilterOptions(
      activeRoster,
      rosterFilterState,
      ownerProfileLookup,
      { team: true },
    )
    const teams = new Map<string, string>()
    for (const employee of roster) {
      const key = rosterTeamKey(employee)
      if (!key) continue
      teams.set(key, rosterTeamLabel(employee))
    }
    return [...teams.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  }, [activeRoster, rosterFilterState, ownerProfileLookup])

  const countryOptions = useMemo(() => {
    const roster = rosterForFilterOptions(
      activeRoster,
      rosterFilterState,
      ownerProfileLookup,
      { country: true },
    )
    const labels = new Set<string>()
    for (const employee of roster) {
      labels.add(resolveDirectoryEmployeeCountry(employee, ownerProfileLookup))
    }
    return sortMonitoringCountryLabels([...labels]).map((label) => ({
      value: label,
      label,
    }))
  }, [activeRoster, rosterFilterState, ownerProfileLookup])

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

  useEffect(() => {
    const valid = new Set(countryOptions.map((option) => option.value))
    setCountryFilter((current) => {
      const next = current.filter((value) => valid.has(value))
      return next.length === current.length ? current : next
    })
  }, [countryOptions])

  const filteredRoster = useMemo(() => {
    if (!rosterFiltersActive) return activeRoster
    return activeRoster.filter((employee) =>
      employeeMatchesRosterFilters(employee, rosterFilterState, ownerProfileLookup),
    )
  }, [activeRoster, rosterFiltersActive, rosterFilterState, ownerProfileLookup])

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
        performanceRecords: canLoadPerformance ? records : [],
        ownerProfileLookup,
        activeRoster: filteredRoster,
      }),
    [
      goals,
      records,
      reviewCycleFilter,
      calendarQuarter,
      calendarYear,
      quarterSelected,
      ownerProfileLookup,
      filteredRoster,
      canLoadPerformance,
    ],
  )

  const checkInSummary = useMemo(() => {
    if (!quarterSelected || calendarQuarter == null) return null
    return buildCheckInCompletionSummary(goals, {
      monitoringQuarter: calendarQuarter,
      monitoringYear: calendarYear,
    })
  }, [goals, calendarQuarter, calendarYear, quarterSelected])

  const toFlagRows = (employees: EmployeeGoalStatus[]): FlagPersonRow[] =>
    employees.map((e) => employeeToFlagPersonRow(e, ownerProfileLookup))

  const pendingManagerRows = useMemo(
    () =>
      buildManagersPendingApproval(
        goals,
        canLoadPerformance ? records : [],
        reviewCycleFilter || null,
      ).map((row) => managerPendingToFlagPersonRow(row, ownerProfileLookup)),
    [goals, records, reviewCycleFilter, ownerProfileLookup, canLoadPerformance],
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

  const managerCompliance = goalsSummary.managerCompliance

  const exportStats = useMemo(() => {
    let filteredGoals = reviewCycleFilter
      ? goals.filter((goal) => goalMatchesReviewCycle(goal, reviewCycleFilter))
      : goals

    if (rosterFiltersActive) {
      const rosterScope = new Set<string>()
      for (const employee of filteredRoster) {
        rosterScope.add(employee.id)
        const email = employee.email?.trim().toLowerCase()
        if (email) rosterScope.add(email)
      }
      filteredGoals = filteredGoals.filter((goal) => {
        const employeeId = goal.employee_id?.trim()
        if (employeeId && rosterScope.has(employeeId)) return true
        const owner = goal.owner?.trim().toLowerCase()
        return owner ? rosterScope.has(owner) : false
      })
    }

    const uniqueGoalIds = new Set(
      filteredGoals.map((goal) => goal.goal_id?.trim() || goal.id).filter(Boolean),
    )
    return {
      metricRows: filteredGoals.length,
      uniqueGoals: uniqueGoalIds.size,
    }
  }, [goals, reviewCycleFilter, rosterFiltersActive, filteredRoster])

  const goalsDetailsUrl = useMemo(() => {
    if (!reviewCycleFilter) return allGoalsDetailsUrl()
    const matchedGoalCycle = goalCycles.find((cycle) =>
      reviewCyclesMatch(reviewCycleFilter, cycle),
    )
    return allGoalsDetailsUrl(matchedGoalCycle ?? reviewCycleFilter)
  }, [reviewCycleFilter, goalCycles])

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

  if (goalsLoading || employeesLoading || (canLoadPerformance && perfLoading)) {
    return <LoadingState />
  }

  return (
    <div className="pd-page">
      <header className="pd-page-header">
        <div>
          <h1 className="pd-page-title">Goal analytics</h1>
          <p className="pd-page-subtitle">
            Track goal submission, manager approval, check-ins, and program compliance by quarter
            and review cycle.
            {canUploadGoals
              ? ' Upload the Revolut Goals CSV export using Upload CSV below.'
              : ''}
          </p>
        </div>
        {canUploadGoals ? (
          <GoalsCsvUpload
            uploading={uploading}
            onUpload={onFileUpload}
            onRefresh={() => reload()}
            importedAt={dataset?.importedAt}
            source={dataset?.source}
          />
        ) : null}
      </header>

      {(goalsError || (canLoadPerformance && perfError) || employeesError) && (
        <div className="pd-alert">{goalsError ?? (canLoadPerformance ? perfError : null) ?? employeesError}</div>
      )}
      {uploadMessage && <p className="pd-page-subtitle">{uploadMessage}</p>}

      {goals.length > 0 ? (
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
          <FilterMultiSelect
            id="monitoring-department-filter"
            label="Department"
            placeholder={hasDepartmentScope ? 'All your departments' : 'All departments'}
            options={departmentOptions}
            selected={departmentFilter}
            onChange={onDepartmentFilterChange}
            active={departmentFilter.length > 0}
          />
          <FilterMultiSelect
            id="monitoring-team-filter"
            label="Team"
            placeholder="All teams"
            options={teamOptions}
            selected={teamFilter}
            onChange={setTeamFilter}
            active={teamFilter.length > 0}
          />
          <FilterMultiSelect
            id="monitoring-country-filter"
            label="Country"
            placeholder="All countries"
            options={countryOptions}
            selected={countryFilter}
            onChange={setCountryFilter}
            active={countryFilter.length > 0}
          />
          {rosterFiltersActive ? (
            <button
              type="button"
              className="pd-btn-secondary pd-btn pd-filter-bar__clear"
              onClick={clearRosterFilters}
            >
              Clear filters
            </button>
          ) : null}
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
          ) : filteredRoster.length === 0 ? (
            <EmptyState
              title="No employees match filters"
              description="Clear department, team, or country filters to restore the monitoring view."
            />
          ) : (
            <>
              {!selectedQuarterStarted && calendarQuarter != null ? (
                <FutureQuarterNotice quarter={calendarQuarter} year={calendarYear} />
              ) : reviewCycleFilter && !selectedCycleHasGoals ? (
                <EmptyState
                  title="No goals found"
                  description={
                    goalCycles.length > 0
                      ? `No employee goals match ${reviewCycleFilter}. Your goals export uses ${goalCycles.join(', ')} — try one of those review cycles, or choose All cycles.`
                      : `No employee goals were exported for ${reviewCycleFilter}. Upload an updated Goals CSV or choose another review cycle.`
                  }
                />
              ) : (
                <>
          <Section
            title="Goal submission & approval"
            action={
              goals.length > 0 ? (
                <Link to={goalsDetailsUrl} className="pd-btn">
                  View Goals
                </Link>
              ) : null
            }
          >
            <GoalSubmissionStatGrid goalsSummary={goalsSummary} exportStats={exportStats} />

            <BreakdownPanelGrid>
              <SubmissionBreakdownTable
                title="By department"
                rows={goalsSummary.breakdownByDepartment}
                searchPlaceholder="Search department…"
              />
              <SubmissionBreakdownTable
                title="By country"
                rows={goalsSummary.breakdownByLocation}
                searchPlaceholder="Search country…"
              />
              <SubmissionBreakdownTable
                title="By team"
                rows={goalsSummary.breakdownByTeam}
                className="pd-breakdown-grid__full"
                searchPlaceholder="Search team or department…"
              />
              <SubmissionBreakdownTable
                title="By manager"
                rows={goalsSummary.breakdownByManager}
                showRowAvatar
                className="pd-breakdown-grid__full"
                searchPlaceholder="Search manager…"
              />
            </BreakdownPanelGrid>

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
            </>
          )}
      </div>
    </div>
  )
}
