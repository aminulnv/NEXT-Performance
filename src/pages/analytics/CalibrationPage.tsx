import { useMemo, useState } from 'react'
import { usePerformanceData } from '@/hooks/usePerformanceData'
import { StatCard } from '@/components/performance/StatCard'
import { LoadingState } from '@/components/performance/LoadingState'
import { EmptyState } from '@/components/performance/EmptyState'
import { buildCalibrationRows, uniqueFieldValues } from '@/lib/metrics'
import '@/styles/performance.css'

export default function CalibrationPage() {
  const { records, loading, error, reload } = usePerformanceData()
  const [cycleFilter, setCycleFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [calibratorFilter, setCalibratorFilter] = useState('')
  const [search, setSearch] = useState('')

  const cycles = useMemo(() => uniqueFieldValues(records, 'cycle_name'), [records])
  const departments = useMemo(() => uniqueFieldValues(records, 'department'), [records])

  const rows = useMemo(() => buildCalibrationRows(records), [records])

  const calibrators = useMemo(() => {
    const set = new Set<string>()
    for (const row of rows) {
      if (row.departmentCalibrator) set.add(row.departmentCalibrator)
      if (row.functionCalibrator) set.add(row.functionCalibrator)
    }
    return [...set].sort()
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (cycleFilter && row.cycleName !== cycleFilter) return false
      if (departmentFilter && row.department !== departmentFilter) return false
      if (
        calibratorFilter &&
        row.departmentCalibrator !== calibratorFilter &&
        row.functionCalibrator !== calibratorFilter
      ) {
        return false
      }
      if (!q) return true
      const hay = [
        row.employeeName,
        row.department,
        row.displayGrade,
        row.departmentCalibrator,
        row.functionCalibrator,
        row.calibrationFlags,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [rows, cycleFilter, departmentFilter, calibratorFilter, search])

  const calibratedCount = useMemo(
    () => filtered.filter((r) => r.gradeCalibrated && r.gradeCalibrated.toLowerCase() !== 'false').length,
    [filtered],
  )

  if (loading) return <LoadingState />
  if (error) return <div className="pd-alert">{error}</div>
  if (records.length === 0) {
    return (
      <EmptyState
        title="No calibration data"
        description="Calibration fields come from final grade records in the Revolut API."
        onRefresh={reload}
      />
    )
  }

  return (
    <div className="pd-page">
      <header className="pd-page-header">
        <div>
          <h1 className="pd-page-title">Calibration</h1>
          <p className="pd-page-subtitle">Calibrator assignments and grade calibration flags</p>
        </div>
      </header>

      <div className="pd-stat-grid">
        <StatCard label="Records" value={filtered.length} />
        <StatCard label="Calibrated" value={calibratedCount} />
        <StatCard label="Not calibrated" value={filtered.length - calibratedCount} />
      </div>

      <div className="pd-filter-bar">
        <div className="pd-form-row">
          <label className="pd-label" htmlFor="cal-search">
            Search
          </label>
          <input
            id="cal-search"
            className="pd-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Employee, calibrator, flags…"
          />
        </div>
        <div className="pd-form-row">
          <label className="pd-label" htmlFor="cal-cycle">
            Cycle
          </label>
          <select id="cal-cycle" className="pd-select" value={cycleFilter} onChange={(e) => setCycleFilter(e.target.value)}>
            <option value="">All</option>
            {cycles.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="pd-form-row">
          <label className="pd-label" htmlFor="cal-dept">
            Department
          </label>
          <select
            id="cal-dept"
            className="pd-select"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          >
            <option value="">All</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="pd-form-row">
          <label className="pd-label" htmlFor="cal-calibrator">
            Calibrator
          </label>
          <select
            id="cal-calibrator"
            className="pd-select"
            value={calibratorFilter}
            onChange={(e) => setCalibratorFilter(e.target.value)}
          >
            <option value="">All</option>
            {calibrators.map((c) => (
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
              <th>Employee</th>
              <th>Cycle</th>
              <th>Department</th>
              <th>Display</th>
              <th>LM</th>
              <th>Calculated</th>
              <th>Dept calibrator</th>
              <th>Function calibrator</th>
              <th>Calibrated</th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', color: '#6b7280' }}>
                  No rows match filters.
                </td>
              </tr>
            ) : (
              filtered.slice(0, 500).map((row) => (
                <tr key={row.recordId}>
                  <td>{row.employeeName || '—'}</td>
                  <td>{row.cycleName || '—'}</td>
                  <td>{row.department || '—'}</td>
                  <td>
                    <span className="pd-badge">{row.displayGrade || '—'}</span>
                  </td>
                  <td>{row.lineManagerGrade || '—'}</td>
                  <td>{row.calculatedGrade || '—'}</td>
                  <td>{row.departmentCalibrator || '—'}</td>
                  <td>{row.functionCalibrator || '—'}</td>
                  <td>{row.gradeCalibrated || '—'}</td>
                  <td title={row.calibrationFlags ?? undefined}>{row.calibrationFlags || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
