import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useEmployeesDirectory } from '@/hooks/useEmployeesDirectory'
import { LoadingState } from '@/components/performance/LoadingState'
import { EmptyState } from '@/components/performance/EmptyState'
import { routes } from '@/lib/routes'
import '@/styles/performance.css'

function uniqueValues(values: Array<string | null | undefined>) {
  return [...new Set(values.filter(Boolean) as string[])].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  )
}

export default function PeoplePage() {
  const { employees, count, loading, error, fetchedAt, source, reload } = useEmployeesDirectory()
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const departments = useMemo(() => uniqueValues(employees.map((e) => e.department)), [employees])
  const statuses = useMemo(() => uniqueValues(employees.map((e) => e.status)), [employees])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return employees.filter((employee) => {
      if (departmentFilter && employee.department !== departmentFilter) return false
      if (statusFilter && employee.status !== statusFilter) return false
      if (!query) return true
      const haystack = [
        employee.name,
        employee.email,
        employee.department,
        employee.team,
        employee.lineManagerName,
        employee.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [employees, search, departmentFilter, statusFilter])

  if (loading) return <LoadingState />
  if (error) return <div className="pd-alert">{error}</div>
  if (employees.length === 0) {
    return (
      <EmptyState
        title="No employee directory"
        description="Fetch the full Revolut People directory (requires REVOLUT_EMAIL and REVOLUT_TOKEN in .env)."
        onRefresh={reload}
      />
    )
  }

  const syncedLabel = fetchedAt ? new Date(fetchedAt).toLocaleString() : 'Unknown'

  return (
    <div className="pd-page">
      <header className="pd-page-header">
        <div>
          <h1 className="pd-page-title">People</h1>
          <p className="pd-page-subtitle">
            {filtered.length} of {count} employees from Revolut
            {source ? ` · ${source}` : ''}
            {fetchedAt ? ` · synced ${syncedLabel}` : ''}
          </p>
        </div>
        <button type="button" className="pd-btn-secondary pd-btn" onClick={reload}>
          Refresh from Revolut
        </button>
      </header>

      <div className="pd-filter-bar">
        <div className="pd-form-row">
          <label className="pd-label" htmlFor="people-search">
            Search
          </label>
          <input
            id="people-search"
            className="pd-input"
            placeholder="Name, email, department, manager…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
            {departments.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
        </div>
        <div className="pd-form-row">
          <label className="pd-label" htmlFor="people-status">
            Status
          </label>
          <select
            id="people-status"
            className="pd-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
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
              <th>Email</th>
              <th>Department</th>
              <th>Team</th>
              <th>Line manager</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: '#6b7280' }}>
                  No employees match filters.
                </td>
              </tr>
            ) : (
              filtered.map((employee) => (
                <tr key={employee.id}>
                  <td>
                    <Link to={routes.organization.person(employee.id)} className="pd-link">
                      {employee.name}
                    </Link>
                  </td>
                  <td>{employee.email || '—'}</td>
                  <td>{employee.department || '—'}</td>
                  <td>{employee.team || '—'}</td>
                  <td>{employee.lineManagerName || '—'}</td>
                  <td>{employee.status || '—'}</td>
                  <td className="pd-table-actions">
                    <Link
                      to={routes.organization.person(employee.id)}
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
