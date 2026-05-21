import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePerformanceData } from '@/hooks/usePerformanceData'
import { GradeDistribution } from '@/components/performance/GradeDistribution'
import { LoadingState } from '@/components/performance/LoadingState'
import { EmptyState } from '@/components/performance/EmptyState'
import { buildDepartmentSummaries, uniqueFieldValues } from '@/lib/metrics'
import { peopleUrl } from '@/lib/peopleFilters'
import '@/styles/performance.css'

export default function DepartmentsPage() {
  const { records, loading, error, reload } = usePerformanceData()
  const [cycleFilter, setCycleFilter] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('')

  const cycles = useMemo(() => uniqueFieldValues(records, 'cycle_name'), [records])
  const departments = useMemo(
    () => buildDepartmentSummaries(records, cycleFilter || undefined),
    [records, cycleFilter],
  )

  const selected = useMemo(
    () => departments.find((d) => d.department === selectedDepartment) ?? null,
    [departments, selectedDepartment],
  )

  if (loading) return <LoadingState />
  if (error) return <div className="pd-alert">{error}</div>
  if (records.length === 0) {
    return (
      <EmptyState
        title="No department data"
        description="Refresh performance data from the Revolut API."
        onRefresh={reload}
      />
    )
  }

  return (
    <div className="pd-page">
      <header className="pd-page-header">
        <div>
          <h1 className="pd-page-title">Departments</h1>
          <p className="pd-page-subtitle">Compare grade distribution and team size by department</p>
        </div>
      </header>

      <div className="pd-filter-bar pd-filter-bar--compact">
        <div className="pd-form-row">
          <label className="pd-label" htmlFor="dept-cycle">
            Cycle
          </label>
          <select
            id="dept-cycle"
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
      </div>

      <div className="pd-panel pd-table-wrap">
        <table className="pd-table">
          <thead>
            <tr>
              <th>Department</th>
              <th>Employees</th>
              <th>Cycles</th>
              <th>Records</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {departments.map((d) => (
              <tr
                key={d.department}
                className={
                  selectedDepartment === d.department
                    ? 'pd-table-row--selected'
                    : 'pd-table-row--clickable'
                }
                onClick={() => setSelectedDepartment(d.department)}
              >
                <td>{d.department}</td>
                <td>{d.employeeCount}</td>
                <td>{d.cyclesCount}</td>
                <td>{d.recordCount}</td>
                <td>
                  <Link
                    to={peopleUrl({ department: d.department, cycle: cycleFilter || undefined })}
                    className="pd-link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View people
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected ? (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link
              to={peopleUrl({
                department: selected.department,
                cycle: cycleFilter || undefined,
              })}
              className="pd-btn"
            >
              View all people in {selected.department}
            </Link>
          </div>
          <div className="pd-grid-2">
            <GradeDistribution
              data={selected.gradeDistribution}
              title={`Grades — ${selected.department}`}
            />
            <div className="pd-panel">
              <h2 className="pd-panel-title">Teams in {selected.department}</h2>
              {selected.teams.length === 0 ? (
                <p style={{ margin: 0, color: '#6b7280' }}>No team breakdown.</p>
              ) : (
                selected.teams.slice(0, 15).map((t) => (
                  <div key={t.team} className="pd-bar-row">
                    <span className="pd-bar-label">{t.team}</span>
                    <span className="pd-bar-count">{t.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
