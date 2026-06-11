import { useEffect, useMemo, useState } from 'react'
import { usePerformanceData } from '@/hooks/usePerformanceData'
import { LoadingState } from '@/components/performance/LoadingState'
import { EmptyState } from '@/components/performance/EmptyState'
import { RatingDistributionPanel } from '@/components/performance/RatingDistributionPanel'
import { paginate, TablePagination } from '@/components/performance/TablePagination'
import { buildRatingMonitoringSummary } from '@/lib/goalsMonitoring'
import { uniqueFieldValues } from '@/lib/metrics'
import '@/styles/performance.css'

const DEV_PERFORMERS_PAGE_SIZE = 10

export default function PerformanceAnalyticsPage() {
  const { records, loading, error } = usePerformanceData()

  const reviewCycles = useMemo(
    () => uniqueFieldValues(records, 'cycle_name'),
    [records],
  )

  const [reviewCycleFilter, setReviewCycleFilter] = useState('Q2 2026')
  const [devSearch, setDevSearch] = useState('')
  const [devDeptFilter, setDevDeptFilter] = useState('')
  const [devCycleFilter, setDevCycleFilter] = useState('')
  const [devRatingFilter, setDevRatingFilter] = useState('')
  const [devPage, setDevPage] = useState(1)

  const ratingSummary = useMemo(
    () => buildRatingMonitoringSummary(records, reviewCycleFilter || null),
    [records, reviewCycleFilter],
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
  }, [devSearch, devDeptFilter, devCycleFilter, devRatingFilter, reviewCycleFilter])

  const devPagination = useMemo(
    () => paginate(filteredDevRows, devPage, DEV_PERFORMERS_PAGE_SIZE),
    [filteredDevRows, devPage],
  )

  if (loading) return <LoadingState />

  return (
    <div className="pd-page">
      <header className="pd-page-header">
        <div>
          <h1 className="pd-page-title">Performance analytics</h1>
          <p className="pd-page-subtitle">
            Rating distribution and developing or unsatisfactory performers by review cycle.
          </p>
        </div>
      </header>

      {error && <div className="pd-alert">{error}</div>}

      {records.length > 0 ? (
        <div
          className="pd-filter-bar pd-filter-bar--compact"
          style={{ marginBottom: '1rem' }}
          aria-label="Filters"
        >
          <div className="pd-form-row">
            <label className="pd-label" htmlFor="perf-review-cycle-filter">
              Review cycle
            </label>
            <select
              id="perf-review-cycle-filter"
              className="pd-select"
              value={reviewCycleFilter}
              onChange={(e) => setReviewCycleFilter(e.target.value)}
            >
              <option value="">All cycles</option>
              {reviewCycles.map((cycle) => (
                <option key={cycle} value={cycle}>
                  {cycle}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <div className="pd-page-main">
        {records.length === 0 ? (
          <EmptyState
            title="No performance data yet"
            description="Sync performance records from the Revolut API first."
          />
        ) : (
          <>
            <section className="pd-section">
              <h2 className="pd-section-title">Rating distribution</h2>
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
            </section>

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
