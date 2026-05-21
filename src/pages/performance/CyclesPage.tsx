import { useMemo, useState } from 'react'
import { usePerformanceData } from '@/hooks/usePerformanceData'
import { buildDashboardSummary, filterRecords } from '@/lib/metrics'
import { buildCycleSummaries } from '@/lib/cycles'
import { GradeDistribution } from '@/components/performance/GradeDistribution'
import { LoadingState } from '@/components/performance/LoadingState'
import { EmptyState } from '@/components/performance/EmptyState'
import '@/styles/performance.css'

export default function CyclesPage() {
  const { records, loading, error, reload } = usePerformanceData()
  const [selectedCycle, setSelectedCycle] = useState('')

  const cycleSummaries = useMemo(() => buildCycleSummaries(records), [records])
  const selectedSummary = useMemo(
    () => cycleSummaries.find((c) => c.cycleName === selectedCycle) ?? null,
    [cycleSummaries, selectedCycle],
  )

  const cycleGradeSummary = useMemo(() => {
    if (!selectedCycle) return null
    const subset = filterRecords(records, { cycleFilter: selectedCycle })
    return buildDashboardSummary(subset)
  }, [records, selectedCycle])

  if (loading) return <LoadingState />
  if (error) return <div className="pd-alert">{error}</div>
  if (records.length === 0) {
    return (
      <EmptyState
        title="No cycle data"
        description="Refresh performance records from the Revolut API."
        onRefresh={reload}
      />
    )
  }

  return (
    <div className="pd-page">
      <header className="pd-page-header">
        <div>
          <h1 className="pd-page-title">Cycles</h1>
          <p className="pd-page-subtitle">
            {cycleSummaries.length} review cycles · completion and grade breakdown
          </p>
        </div>
      </header>

      <section>
        <h2 className="pd-section-heading">All cycles</h2>
        <div className="pd-panel pd-table-wrap">
          <table className="pd-table">
            <thead>
              <tr>
                <th>Cycle</th>
                <th>Records</th>
                <th>Employees</th>
                <th>Timeline completed</th>
                <th>Top timeline status</th>
              </tr>
            </thead>
            <tbody>
              {cycleSummaries.map((c) => (
                <tr
                  key={c.cycleName}
                  className={
                    selectedCycle === c.cycleName
                      ? 'pd-table-row--selected'
                      : 'pd-table-row--clickable'
                  }
                  onClick={() => setSelectedCycle(c.cycleName)}
                >
                  <td>{c.cycleName}</td>
                  <td>{c.recordCount}</td>
                  <td>{c.employeeCount}</td>
                  <td>{c.withCompletedTimeline}</td>
                  <td>{c.timelineStatusCounts[0]?.status ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedCycle && selectedSummary && cycleGradeSummary ? (
        <>
          <div className="pd-grid-2">
            <GradeDistribution
              data={cycleGradeSummary.gradeDistribution}
              title={`Grades — ${selectedCycle}`}
            />
            <div className="pd-panel">
              <h2 className="pd-panel-title">Summary</h2>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151' }}>
                {cycleGradeSummary.totalRecords} records · {cycleGradeSummary.totalEmployees}{' '}
                employees
              </p>
            </div>
          </div>

          <div className="pd-grid-2">
            <div className="pd-panel">
              <h2 className="pd-panel-title">Timeline status</h2>
              {selectedSummary.timelineStatusCounts.map((row) => (
                <div key={row.status} className="pd-bar-row">
                  <span className="pd-bar-label">{row.status}</span>
                  <span className="pd-bar-count">{row.count}</span>
                </div>
              ))}
            </div>
            <div className="pd-panel">
              <h2 className="pd-panel-title">Employee cycle outcome</h2>
              {selectedSummary.outcomeCounts.map((row) => (
                <div key={row.outcome} className="pd-bar-row">
                  <span className="pd-bar-label">{row.outcome}</span>
                  <span className="pd-bar-count">{row.count}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="pd-panel">
          <p style={{ margin: 0, color: '#6b7280' }}>Select a cycle to view completion and grades.</p>
        </div>
      )}
    </div>
  )
}
