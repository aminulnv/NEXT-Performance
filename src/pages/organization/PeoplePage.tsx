import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePerformanceData } from '@/hooks/usePerformanceData'
import { LoadingState } from '@/components/performance/LoadingState'
import { EmptyState } from '@/components/performance/EmptyState'
import { dedupeEmployees, uniqueFieldValues } from '@/lib/metrics'
import { readPeopleFilters } from '@/lib/peopleFilters'
import { routes } from '@/lib/routes'
import '@/styles/performance.css'

export default function PeoplePage() {
  const { records, loading, error, reload } = usePerformanceData()
  const [searchParams] = useSearchParams()
  const urlFilters = readPeopleFilters(searchParams)

  const [search, setSearch] = useState('')
  const [cycleFilter, setCycleFilter] = useState(urlFilters.cycle ?? '')
  const [departmentFilter, setDepartmentFilter] = useState(urlFilters.department ?? '')

  useEffect(() => {
    setCycleFilter(urlFilters.cycle ?? '')
    setDepartmentFilter(urlFilters.department ?? '')
  }, [urlFilters.cycle, urlFilters.department])

  const cycles = useMemo(() => uniqueFieldValues(records, 'cycle_name'), [records])
  const departments = useMemo(() => uniqueFieldValues(records, 'department'), [records])

  const people = useMemo(() => {
    let filteredRecords = records
    if (cycleFilter) filteredRecords = filteredRecords.filter((r) => r.cycle_name === cycleFilter)
    if (departmentFilter) {
      filteredRecords = filteredRecords.filter((r) => r.department === departmentFilter)
    }
    return dedupeEmployees(filteredRecords)
  }, [records, cycleFilter, departmentFilter])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return people.filter((p) => {
      if (!q) return true
      const hay = [p.employeeName, p.department, p.lineManagerName, p.latestCycle]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [people, search])

  if (loading) return <LoadingState />
  if (error) return <div className="pd-alert">{error}</div>
  if (records.length === 0) {
    return (
      <EmptyState
        title="No people data"
        description="Refresh performance data from the Revolut API (npm run dev with REVOLUT_* in .env)."
        onRefresh={reload}
      />
    )
  }

  return (
    <div className="pd-page">
      <header className="pd-page-header">
        <div>
          <h1 className="pd-page-title">People</h1>
          <p className="pd-page-subtitle">
            {filtered.length} unique employees
            {departmentFilter ? ` in ${departmentFilter}` : ''}
            {cycleFilter ? ` · cycle ${cycleFilter}` : ''}
          </p>
        </div>
        {departmentFilter ? (
          <Link to={routes.organization.departments} className="pd-btn-secondary pd-btn">
            ← Departments
          </Link>
        ) : null}
      </header>

      <div className="pd-filter-bar">
        <div className="pd-form-row">
          <label className="pd-label" htmlFor="people-search">
            Search
          </label>
          <input
            id="people-search"
            className="pd-input"
            placeholder="Name, department, line manager…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="pd-form-row">
          <label className="pd-label" htmlFor="people-cycle">
            Cycle
          </label>
          <select
            id="people-cycle"
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
          <label className="pd-label" htmlFor="people-dept">
            Department
          </label>
          <select
            id="people-dept"
            className="pd-select"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="pd-panel pd-table-wrap">
        <table className="pd-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Department</th>
              <th>Line manager</th>
              <th>Cycles</th>
              <th>Latest cycle</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#6b7280' }}>
                  No people match filters.
                </td>
              </tr>
            ) : (
              filtered.slice(0, 500).map((p) => (
                <tr key={p.employeeId}>
                  <td>
                    <Link to={routes.organization.person(p.employeeId)} className="pd-link">
                      {p.employeeName}
                    </Link>
                  </td>
                  <td>{p.department || '—'}</td>
                  <td>{p.lineManagerName || '—'}</td>
                  <td>{p.cyclesCount}</td>
                  <td>{p.latestCycle || '—'}</td>
                  <td className="pd-table-actions">
                    <Link
                      to={routes.organization.person(p.employeeId)}
                      className="pd-btn-secondary pd-btn pd-btn--sm"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
