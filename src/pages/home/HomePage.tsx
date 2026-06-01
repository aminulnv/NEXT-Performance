import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useEmployeesDirectory } from '@/hooks/useEmployeesDirectory'
import { usePerformanceData } from '@/hooks/usePerformanceData'
import { filterActiveEmployees, filterRecordsByActiveEmployees } from '@/lib/activeEmployees'
import { StatCard } from '@/components/performance/StatCard'
import { GradeDistribution } from '@/components/performance/GradeDistribution'
import { EmptyState } from '@/components/performance/EmptyState'
import { LoadingState } from '@/components/performance/LoadingState'
import { buildDashboardSummary } from '@/lib/metrics'
import { routes } from '@/lib/routes'
import '@/styles/performance.css'

export default function HomePage() {
  const { canManageUsers } = useAuth()
  const { records, loading, error, warning, reload } = usePerformanceData()
  const {
    employees: directoryEmployees,
    loading: employeesLoading,
    error: employeesError,
    reload: reloadEmployees,
  } = useEmployeesDirectory()

  const activeRoster = useMemo(
    () => filterActiveEmployees(directoryEmployees),
    [directoryEmployees],
  )

  const activeRecords = useMemo(
    () => filterRecordsByActiveEmployees(records, directoryEmployees),
    [records, directoryEmployees],
  )

  const dashboardSummary = useMemo(
    () => (activeRecords.length > 0 ? buildDashboardSummary(activeRecords) : null),
    [activeRecords],
  )

  if (loading || employeesLoading) return <LoadingState />

  if (error || employeesError) {
    return (
      <div className="pd-page">
        <div className="pd-alert">{error ?? employeesError}</div>
        <button
          type="button"
          className="pd-btn"
          onClick={() => {
            reload()
            reloadEmployees()
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="pd-page">
        <EmptyState
          title="No performance data yet"
          description="Start the API server (npm run dev) with REVOLUT_EMAIL and REVOLUT_TOKEN in .env."
          onRefresh={reload}
        />
      </div>
    )
  }

  if (activeRoster.length === 0) {
    return (
      <div className="pd-page">
        <EmptyState
          title="No active employees in directory"
          description="Sync the employee directory from Organization → People so Home uses active employees only."
          onRefresh={() => {
            reload()
            reloadEmployees()
          }}
        />
      </div>
    )
  }

  if (!dashboardSummary) {
    return (
      <div className="pd-page">
        <EmptyState
          title="No performance data for active employees"
          description={`${activeRoster.length} active employees in People, but none match performance records yet.`}
          onRefresh={() => {
            reload()
            reloadEmployees()
          }}
        />
      </div>
    )
  }

  const displaySummary = dashboardSummary
  const recordsWithoutScorecard =
    displaySummary.totalRecords - displaySummary.recordsWithScorecard

  return (
    <div className="pd-page">
      <header className="pd-page-header">
        <div>
          <h1 className="pd-page-title">Home</h1>
          <p className="pd-page-subtitle">
            Active employees only · {displaySummary.recordsWithScorecard} scorecards ·{' '}
            {displaySummary.totalRecords} final grades · {displaySummary.cycles.length} review cycles
          </p>
        </div>
        <button
          type="button"
          className="pd-btn-secondary pd-btn"
          onClick={() => {
            reload()
            reloadEmployees()
          }}
        >
          Refresh
        </button>
      </header>

      {warning ? <div className="pd-alert pd-alert-info">{warning}</div> : null}

      <section>
        <h2 className="pd-section-heading">Summary</h2>
        <div className="pd-stat-grid">
          <StatCard
            label="Employees"
            value={activeRoster.length}
            hint="status = Active · People directory"
          />
          <StatCard
            label="Scorecards"
            value={displaySummary.recordsWithScorecard}
            hint={`Rows with reviewer, status, or ratings`}
          />
          <StatCard
            label="Final grades"
            value={displaySummary.totalRecords}
            hint={`${recordsWithoutScorecard} rows have no scorecard data`}
          />
          <StatCard label="Cycles" value={displaySummary.cycles.length} />
          <StatCard label="Departments" value={displaySummary.departments.length} />
        </div>
      </section>

      <div className="pd-grid-2">
        <GradeDistribution data={displaySummary.gradeDistribution} title="Grade distribution" />
        <div className="pd-panel pd-dept-summary">
          <h2 className="pd-panel-title">Top departments</h2>
          {displaySummary.byDepartment.length === 0 ? (
            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>No department data.</p>
          ) : (
            displaySummary.byDepartment.slice(0, 10).map((row) => (
              <div key={row.department} className="pd-bar-row">
                <span className="pd-bar-label">{row.department}</span>
                <span className="pd-bar-count">{row.count}</span>
              </div>
            ))
          )}
          <p style={{ margin: '1rem 0 0', fontSize: '0.8125rem' }}>
            <Link to={routes.organization.departments} className="pd-link">
              Compare all departments →
            </Link>
          </p>
        </div>
      </div>

      <section>
        <h2 className="pd-section-heading">Quick links</h2>
        <div className="pd-preset-grid">
          <Link to={routes.performance.records} className="pd-preset-card pd-preset-card--link">
            <strong>Performance records</strong>
            <span>Browse and filter all review records</span>
          </Link>
          <Link to={`${routes.performance.records}?view=scorecards`} className="pd-preset-card pd-preset-card--link">
            <strong>Scorecards</strong>
            <span>Records with scorecard ratings and reviewers</span>
          </Link>
          <Link to={routes.performance.cycles} className="pd-preset-card pd-preset-card--link">
            <strong>Review cycles</strong>
            <span>Completion and timeline status by cycle</span>
          </Link>
          <Link to={routes.analytics.explore} className="pd-preset-card pd-preset-card--link">
            <strong>Analytics explore</strong>
            <span>Custom charts and metric presets</span>
          </Link>
          <Link to={routes.goals.root} className="pd-preset-card pd-preset-card--link">
            <strong>Goals</strong>
            <span>Import and browse goals CSV data</span>
          </Link>
          <Link to={routes.analytics.monitoring} className="pd-preset-card pd-preset-card--link">
            <strong>Monitoring</strong>
            <span>Goal check-ins, ratings, and program indicators</span>
          </Link>
          {canManageUsers ? (
            <Link
              to={routes.admin.access}
              className="pd-preset-card pd-preset-card--link pd-preset-card--admin"
            >
              <strong>
                <Users size={16} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />
                User management
              </strong>
              <span>Add people, assign roles, bulk CSV import</span>
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  )
}
