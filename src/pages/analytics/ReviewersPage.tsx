import { useEffect, useMemo, useState } from 'react'
import { usePerformanceData } from '@/hooks/usePerformanceData'
import { StatCard } from '@/components/performance/StatCard'
import { MetricTermLabel } from '@/components/performance/MetricInfo'
import { REVIEWER_METRIC_HELP } from '@/lib/reviewerMetricHelp'
import { EmptyState } from '@/components/performance/EmptyState'
import { LoadingState } from '@/components/performance/LoadingState'
import { paginate, TablePagination } from '@/components/performance/TablePagination'
import { uniqueFieldValues } from '@/lib/metrics'
import {
  buildReviewTimingSummary,
  formatDuration,
  formatScorecardDateTime,
  getScorecardTiming,
} from '@/lib/scorecard'
import type { PerformanceRecord } from '@/types/performance'
import '@/styles/performance.css'

type ReviewerFilters = {
  search?: string
  cycle?: string
  department?: string
}

const EMPTY_FILTERS: ReviewerFilters = {}

function applyReviewerFilters(records: PerformanceRecord[], filters: ReviewerFilters): PerformanceRecord[] {
  const q = filters.search?.trim().toLowerCase() ?? ''
  return records.filter((r) => {
    if (filters.cycle && r.cycle_name !== filters.cycle) return false
    if (filters.department && r.department !== filters.department) return false
    if (!q) return true
    const { reviewer } = getScorecardTiming(r)
    const name = (reviewer ?? 'Unknown reviewer').toLowerCase()
    return name.includes(q)
  })
}

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <div className="pd-form-row">
      <label className="pd-label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="pd-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  )
}

export default function Reviewers() {
  const { records, loading, error, reload } = usePerformanceData()
  const [filters, setFilters] = useState<ReviewerFilters>(EMPTY_FILTERS)
  const [reviewerPage, setReviewerPage] = useState(1)
  const [reviewsPage, setReviewsPage] = useState(1)

  const cycles = useMemo(() => uniqueFieldValues(records, 'cycle_name'), [records])
  const departments = useMemo(() => uniqueFieldValues(records, 'department'), [records])

  const filtered = useMemo(
    () => applyReviewerFilters(records, filters),
    [records, filters],
  )

  const reviewTiming = useMemo(() => buildReviewTimingSummary(filtered), [filtered])

  const reviewsWithTiming = useMemo(() => {
    return filtered
      .map((r) => ({ record: r, timing: getScorecardTiming(r) }))
      .filter((row) => row.timing.durationMs != null)
      .sort((a, b) => (b.timing.durationMs ?? 0) - (a.timing.durationMs ?? 0))
  }, [filtered])

  useEffect(() => {
    setReviewerPage(1)
    setReviewsPage(1)
  }, [filters])

  const reviewerPagination = useMemo(
    () => paginate(reviewTiming.byReviewer, reviewerPage),
    [reviewTiming.byReviewer, reviewerPage],
  )

  const reviewsPagination = useMemo(
    () => paginate(reviewsWithTiming, reviewsPage),
    [reviewsWithTiming, reviewsPage],
  )

  const hasActiveFilters = Boolean(filters.search || filters.cycle || filters.department)

  const setFilter = <K extends keyof ReviewerFilters>(key: K, value: ReviewerFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }))
  }

  if (loading) return <LoadingState />
  if (error) {
    return (
      <div className="pd-page">
        <div className="pd-alert">{error}</div>
        <button type="button" className="pd-btn" onClick={reload}>
          Retry
        </button>
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <EmptyState
        title="No performance data yet"
        description="Load data from Revolut with scorecards enabled (INCLUDE_SCORECARDS=true)."
        onRefresh={reload}
      />
    )
  }

  return (
    <div className="pd-page">
      <header className="pd-page-header">
        <div>
          <h1 className="pd-page-title">Reviewers</h1>
          <p className="pd-page-subtitle">
            How long reviewers took from scorecard opened to completed · {filtered.length} of{' '}
            {records.length} records
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {hasActiveFilters ? (
            <button type="button" className="pd-btn-secondary pd-btn" onClick={() => setFilters(EMPTY_FILTERS)}>
              Clear filters
            </button>
          ) : null}
          <button type="button" className="pd-btn-secondary pd-btn" onClick={reload}>
            Refresh
          </button>
        </div>
      </header>


      <section>
        <div className="pd-stat-grid">
          <StatCard
            label="Reviews with timing"
            labelHelp={REVIEWER_METRIC_HELP.reviewsWithTiming}
            value={reviewTiming.withTiming}
            hint={
              reviewTiming.withoutTiming > 0
                ? `${reviewTiming.withoutTiming} missing opened/completed dates`
                : undefined
            }
          />
          <StatCard
            label="Reviewers"
            labelHelp={REVIEWER_METRIC_HELP.reviewers}
            value={reviewTiming.byReviewer.length}
          />
          <StatCard
            label="Median review time"
            labelHelp={REVIEWER_METRIC_HELP.medianReviewTime}
            value={formatDuration(reviewTiming.medianDurationMs)}
          />
          <StatCard
            label="Average review time"
            labelHelp={REVIEWER_METRIC_HELP.averageReviewTime}
            value={formatDuration(reviewTiming.avgDurationMs)}
          />
        </div>
      </section>

      <section>
        <h2 className="pd-section-heading">By reviewer</h2>
        <div className="pd-panel pd-master-filters">
          <div className="pd-filter-grid">
            <div className="pd-form-row pd-filter-search">
              <label className="pd-label" htmlFor="reviewer-search">
                Search
              </label>
              <input
                id="reviewer-search"
                className="pd-input"
                placeholder="Reviewer name…"
                value={filters.search ?? ''}
                onChange={(e) => setFilter('search', e.target.value)}
              />
            </div>
            <FilterSelect
              id="reviewer-cycle"
              label="Cycle"
              value={filters.cycle ?? ''}
              options={cycles}
              onChange={(v) => setFilter('cycle', v)}
            />
            <FilterSelect
              id="reviewer-department"
              label="Department"
              value={filters.department ?? ''}
              options={departments}
              onChange={(v) => setFilter('department', v)}
            />
          </div>
        </div>
        <div className="pd-panel pd-table-wrap">
          {reviewTiming.byReviewer.length === 0 ? (
            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
              No scorecard timing data for the current filters. Ensure{' '}
              <code style={{ fontSize: '0.85em' }}>INCLUDE_SCORECARDS=true</code> and refresh.
            </p>
          ) : (
            <table className="pd-table">
              <thead>
                <tr>
                  <th>
                    <MetricTermLabel label="Reviewer" help={REVIEWER_METRIC_HELP.reviewer} />
                  </th>
                  <th>
                    <MetricTermLabel label="Reviews" help={REVIEWER_METRIC_HELP.reviews} />
                  </th>
                  <th>
                    <MetricTermLabel label="Median time" help={REVIEWER_METRIC_HELP.medianTime} />
                  </th>
                  <th>
                    <MetricTermLabel label="Average time" help={REVIEWER_METRIC_HELP.averageTime} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {reviewerPagination.items.map((row) => (
                  <tr key={row.reviewer}>
                    <td>{row.reviewer}</td>
                    <td>{row.reviewCount}</td>
                    <td>{formatDuration(row.medianDurationMs)}</td>
                    <td>{formatDuration(row.avgDurationMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <TablePagination
            page={reviewerPagination.page}
            totalPages={reviewerPagination.totalPages}
            totalItems={reviewerPagination.totalItems}
            startIndex={reviewerPagination.startIndex}
            endIndex={reviewerPagination.endIndex}
            onPageChange={setReviewerPage}
          />
        </div>
      </section>

      <section>
        <h2 className="pd-section-heading">Reviews</h2>
        <div className="pd-panel pd-table-wrap">
          <table className="pd-table">
            <thead>
              <tr>
                <th>
                  <MetricTermLabel label="Employee" help={REVIEWER_METRIC_HELP.employee} />
                </th>
                <th>
                  <MetricTermLabel label="Reviewer" help={REVIEWER_METRIC_HELP.reviewer} />
                </th>
                <th>
                  <MetricTermLabel label="Department" help={REVIEWER_METRIC_HELP.department} />
                </th>
                <th>
                  <MetricTermLabel label="Cycle" help={REVIEWER_METRIC_HELP.cycle} />
                </th>
                <th>
                  <MetricTermLabel label="Status" help={REVIEWER_METRIC_HELP.status} />
                </th>
                <th>
                  <MetricTermLabel label="Opened" help={REVIEWER_METRIC_HELP.opened} />
                </th>
                <th>
                  <MetricTermLabel label="Completed" help={REVIEWER_METRIC_HELP.completed} />
                </th>
                <th>
                  <MetricTermLabel label="Review time" help={REVIEWER_METRIC_HELP.reviewTime} />
                </th>
              </tr>
            </thead>
            <tbody>
              {reviewsWithTiming.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ color: '#6b7280', textAlign: 'center' }}>
                    No completed reviews with timing in the current filters.
                  </td>
                </tr>
              ) : (
                reviewsPagination.items.map(({ record: r, timing }) => (
                  <tr key={r.id}>
                    <td>{r.employee_name || r.employee_id}</td>
                    <td>{timing.reviewer || '—'}</td>
                    <td>{r.department || '—'}</td>
                    <td>{r.cycle_name || '—'}</td>
                    <td>{timing.status || '—'}</td>
                    <td>{formatScorecardDateTime(timing.openedAt)}</td>
                    <td>{formatScorecardDateTime(timing.completedAt)}</td>
                    <td>{formatDuration(timing.durationMs)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <TablePagination
            page={reviewsPagination.page}
            totalPages={reviewsPagination.totalPages}
            totalItems={reviewsPagination.totalItems}
            startIndex={reviewsPagination.startIndex}
            endIndex={reviewsPagination.endIndex}
            onPageChange={setReviewsPage}
          />
        </div>
      </section>
    </div>
  )
}
