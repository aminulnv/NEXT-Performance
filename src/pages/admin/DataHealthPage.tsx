import { usePerformanceData } from '@/hooks/usePerformanceData'
import { StatCard } from '@/components/performance/StatCard'
import { LoadingState } from '@/components/performance/LoadingState'
import { countAllScorecardsEmbedded, countRecordsWithScorecardTiming } from '@/lib/metrics'
import '@/styles/performance.css'

function formatSyncTime(iso: string | null) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString()
}

export default function DataHealthPage() {
  const { records, summary, loading, error, warning, cacheStatus, reload } = usePerformanceData()

  if (loading) return <LoadingState />

  const { withScorecard, withTiming } = countRecordsWithScorecardTiming(records)
  const { recordsWithList, totalScorecards } = countAllScorecardsEmbedded(records)

  return (
    <div className="pd-page">
      <header className="pd-page-header">
        <div>
          <h1 className="pd-page-title">Data health</h1>
          <p className="pd-page-subtitle">Sync status and record completeness from the Revolut API</p>
        </div>
        <button type="button" className="pd-btn" onClick={reload}>
          Refresh data
        </button>
      </header>

      {error ? <div className="pd-alert">{error}</div> : null}
      {warning ? <div className="pd-alert pd-alert-info">{warning}</div> : null}

      <div className="pd-stat-grid">
        <StatCard label="Total records" value={records.length} />
        <StatCard label="Unique employees" value={summary?.totalEmployees ?? 0} />
        <StatCard label="With scorecard fields" value={withScorecard} />
        <StatCard label="With review timing" value={withTiming} />
        <StatCard label="Multi-scorecard records" value={recordsWithList} />
        <StatCard label="Scorecards (all JSON)" value={totalScorecards} />
      </div>

      <div className="pd-panel">
        <h2 className="pd-panel-title">Sync</h2>
        <dl className="pd-dl">
          <dt>Last synced</dt>
          <dd>{formatSyncTime(summary?.lastSyncedAt ?? null)}</dd>
          <dt>Cache</dt>
          <dd>{cacheStatus || 'Unknown'}</dd>
          <dt>Cycles in dataset</dt>
          <dd>{summary?.cycles.length ?? 0}</dd>
          <dt>Departments in dataset</dt>
          <dd>{summary?.departments.length ?? 0}</dd>
          <dt>Records with all scorecards JSON</dt>
          <dd>
            {recordsWithList} ({totalScorecards} scorecards total)
          </dd>
        </dl>
      </div>
    </div>
  )
}
