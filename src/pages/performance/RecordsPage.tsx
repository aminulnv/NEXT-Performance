import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePerformanceData } from '@/hooks/usePerformanceData'
import { EmptyState } from '@/components/performance/EmptyState'
import { LoadingState } from '@/components/performance/LoadingState'
import { RecordDetailDrawer } from '@/components/performance/RecordDetailDrawer'
import { paginate, TablePagination } from '@/components/performance/TablePagination'
import { displayRatingLabel } from '@/lib/formatRatingLabel'
import { applyMasterFilters, uniqueFieldValues } from '@/lib/metrics'
import { routes } from '@/lib/routes'
import { getScorecardDetail, hasScorecardData } from '@/lib/scorecardPayload'
import { getScorecardTiming } from '@/lib/scorecard'
import type { MasterFilters, PerformanceRecord } from '@/types/performance'
import '@/styles/performance.css'

type RecordsView = 'all' | 'scorecards' | 'no-scorecard'

const EMPTY_FILTERS: MasterFilters = {}
const RECORDS_TABLE_COLUMN_COUNT = 10

type RecordsTableProps = {
  rows: PerformanceRecord[]
  emptyMessage: string
  onSelectRecord: (record: PerformanceRecord) => void
}

function RecordsTable({ rows, emptyMessage, onSelectRecord }: RecordsTableProps) {
  return (
    <div className="pd-panel pd-table-wrap">
      <table className="pd-table pd-table--records">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Department</th>
            <th>Cycle</th>
            <th>Display grade</th>
            <th>Reviewer</th>
            <th>Deliverables</th>
            <th>Values</th>
            <th>Skills</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={RECORDS_TABLE_COLUMN_COUNT} style={{ color: '#6b7280', textAlign: 'center' }}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((r) => {
              const detail = getScorecardDetail(r)
              const deliverables = detail.sections.find((s) => s.title === 'Deliverables')
              const values = detail.sections.find((s) => s.title === 'Values')
              const skills = detail.sections.find((s) => s.title === 'Skills')
              return (
                <tr
                  key={r.id}
                  className="pd-table-row--clickable"
                  onClick={() => onSelectRecord(r)}
                >
                  <td>{r.employee_name || r.employee_id || '—'}</td>
                  <td>{r.department || '—'}</td>
                  <td>{r.cycle_name || '—'}</td>
                  <td>
                    <span className="pd-badge">{r.display_grade || '—'}</span>
                  </td>
                  <td>{detail.reviewer || '—'}</td>
                  <td>{displayRatingLabel(deliverables?.rating)}</td>
                  <td>{displayRatingLabel(values?.rating)}</td>
                  <td>{displayRatingLabel(skills?.rating)}</td>
                  <td>{displayRatingLabel(detail.status)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {hasScorecardData(r) ? (
                      <Link to={routes.performance.scorecard(r.id)} className="pd-link">
                        Open
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
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
      <select id={id} className="pd-select" value={value} onChange={(e) => onChange(e.target.value)}>
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

function parseView(param: string | null): RecordsView {
  if (param === 'scorecards') return 'scorecards'
  if (param === 'no-scorecard') return 'no-scorecard'
  return 'all'
}

export default function RecordsPage() {
  const { records, loading, error, reload } = usePerformanceData()
  const [searchParams, setSearchParams] = useSearchParams()
  const view = parseView(searchParams.get('view'))
  const [filters, setFilters] = useState<MasterFilters>(EMPTY_FILTERS)
  const [statusFilter, setStatusFilter] = useState('')
  const [recordsPage, setRecordsPage] = useState(1)
  const [selectedRecord, setSelectedRecord] = useState<PerformanceRecord | null>(null)

  const cycles = useMemo(() => uniqueFieldValues(records, 'cycle_name'), [records])
  const departments = useMemo(() => uniqueFieldValues(records, 'department'), [records])
  const teams = useMemo(() => uniqueFieldValues(records, 'team'), [records])
  const displayGrades = useMemo(() => uniqueFieldValues(records, 'display_grade'), [records])
  const lmGrades = useMemo(() => uniqueFieldValues(records, 'line_manager_grade'), [records])

  const statuses = useMemo(() => {
    const set = new Set<string>()
    for (const r of records) {
      const s = getScorecardTiming(r).status
      if (s) set.add(s)
    }
    return [...set].sort()
  }, [records])

  const withScorecardCount = useMemo(
    () => records.filter((r) => hasScorecardData(r)).length,
    [records],
  )

  const filtered = useMemo(() => {
    let rows = applyMasterFilters(records, filters)
    if (statusFilter) {
      rows = rows.filter((r) => getScorecardTiming(r).status === statusFilter)
    }
    if (view === 'scorecards') {
      rows = rows.filter((r) => hasScorecardData(r))
    } else if (view === 'no-scorecard') {
      rows = rows.filter((r) => !hasScorecardData(r))
    }
    return rows
  }, [records, filters, view, statusFilter])

  useEffect(() => {
    setRecordsPage(1)
  }, [filters, view, statusFilter])

  const recordsPagination = useMemo(
    () => paginate(filtered, recordsPage),
    [filtered, recordsPage],
  )

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.cycle ||
      filters.department ||
      filters.team ||
      filters.displayGrade ||
      filters.lineManagerGrade ||
      statusFilter,
  )

  const setFilter = <K extends keyof MasterFilters>(key: K, value: MasterFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }))
  }

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS)
    setStatusFilter('')
  }

  const setView = (next: RecordsView) => {
    const nextParams = new URLSearchParams(searchParams)
    if (next === 'all') nextParams.delete('view')
    else nextParams.set('view', next)
    setSearchParams(nextParams, { replace: true })
  }

  const withoutScorecardCount = useMemo(
    () => records.filter((r) => !hasScorecardData(r)).length,
    [records],
  )

  if (loading) return <LoadingState />
  if (error) return <div className="pd-alert">{error}</div>
  if (records.length === 0) {
    return (
      <EmptyState
        title="No performance data"
        description="Refresh performance records from the Revolut API."
        onRefresh={reload}
      />
    )
  }

  return (
    <div className="pd-page">
      <header className="pd-page-header pd-page-header--records">
        <div className="pd-page-header__main">
          <div className="pd-page-header__title-row">
            <h1 className="pd-page-title">Records</h1>
            <div className="pd-view-toggle pd-view-toggle--header" role="tablist" aria-label="Record view">
              <button
                type="button"
                role="tab"
                aria-selected={view === 'all'}
                className={`pd-view-toggle__btn${view === 'all' ? ' pd-view-toggle__btn--active' : ''}`}
                onClick={() => setView('all')}
              >
                All records
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'scorecards'}
                className={`pd-view-toggle__btn${view === 'scorecards' ? ' pd-view-toggle__btn--active' : ''}`}
                onClick={() => setView('scorecards')}
              >
                Scorecards
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'no-scorecard'}
                className={`pd-view-toggle__btn${view === 'no-scorecard' ? ' pd-view-toggle__btn--active' : ''}`}
                onClick={() => setView('no-scorecard')}
                title="Temporary — grade rows with no linked scorecard fields"
              >
                Without scorecard
                <span className="pd-view-toggle__badge">temp</span>
              </button>
            </div>
          </div>
          <p className="pd-page-subtitle">
            {filtered.length}{' '}
            {view === 'scorecards'
              ? 'scorecard record'
              : view === 'no-scorecard'
                ? 'record without scorecard data'
                : 'record'}
            {filtered.length === 1 ? '' : 's'}
            {view === 'all'
              ? ` of ${records.length}`
              : view === 'scorecards'
                ? ` of ${withScorecardCount} (${records.length} total)`
                : view === 'no-scorecard'
                  ? ` of ${withoutScorecardCount} (${records.length} total)`
                  : ''}
          </p>
        </div>
        <div className="pd-page-header__buttons">
          {hasActiveFilters ? (
            <button type="button" className="pd-btn-secondary pd-btn" onClick={clearFilters}>
              Clear filters
            </button>
          ) : null}
          <button type="button" className="pd-btn-secondary pd-btn" onClick={reload}>
            Refresh
          </button>
        </div>
      </header>

      <section>
        <div className="pd-panel pd-master-filters">
          <div className="pd-filter-grid">
            <div className="pd-form-row pd-filter-search">
              <label className="pd-label" htmlFor="records-search">
                Search
              </label>
              <input
                id="records-search"
                className="pd-input"
                placeholder="Name, department, team, grade, reviewer, status…"
                value={filters.search ?? ''}
                onChange={(e) => setFilter('search', e.target.value)}
              />
            </div>
            <FilterSelect
              id="records-cycle"
              label="Cycle"
              value={filters.cycle ?? ''}
              options={cycles}
              onChange={(v) => setFilter('cycle', v)}
            />
            <FilterSelect
              id="records-department"
              label="Department"
              value={filters.department ?? ''}
              options={departments}
              onChange={(v) => setFilter('department', v)}
            />
            <FilterSelect
              id="records-team"
              label="Team"
              value={filters.team ?? ''}
              options={teams}
              onChange={(v) => setFilter('team', v)}
            />
            <FilterSelect
              id="records-display-grade"
              label="Display grade"
              value={filters.displayGrade ?? ''}
              options={displayGrades}
              onChange={(v) => setFilter('displayGrade', v)}
            />
            <FilterSelect
              id="records-lm-grade"
              label="Line manager grade"
              value={filters.lineManagerGrade ?? ''}
              options={lmGrades}
              onChange={(v) => setFilter('lineManagerGrade', v)}
            />
            <FilterSelect
              id="records-status"
              label="Scorecard status"
              value={statusFilter}
              options={statuses}
              onChange={setStatusFilter}
            />
          </div>
        </div>

        <p className="pd-page-hint">
          {view === 'all'
            ? 'All performance records. Click a row for a quick preview.'
            : view === 'scorecards'
              ? 'Records with scorecard reviewer, status, or ratings.'
              : 'Records with a final grade but no primary scorecard fields in the sync.'}{' '}
          Same columns on every tab — only the row set changes.
        </p>
        <RecordsTable
          rows={recordsPagination.items}
          emptyMessage={
            view === 'scorecards'
              ? 'No scorecard records match the current filters.'
              : view === 'no-scorecard'
                ? 'No records without scorecard data match the current filters.'
                : 'No rows match the current filters.'
          }
          onSelectRecord={setSelectedRecord}
        />
        <TablePagination
          page={recordsPagination.page}
          totalPages={recordsPagination.totalPages}
          totalItems={recordsPagination.totalItems}
          startIndex={recordsPagination.startIndex}
          endIndex={recordsPagination.endIndex}
          onPageChange={setRecordsPage}
        />
      </section>

      <RecordDetailDrawer record={selectedRecord} onClose={() => setSelectedRecord(null)} />
    </div>
  )
}
