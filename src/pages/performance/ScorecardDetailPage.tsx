import { Link, useParams } from 'react-router-dom'
import { usePerformanceData } from '@/hooks/usePerformanceData'
import { LoadingState } from '@/components/performance/LoadingState'
import { ScorecardSections } from '@/components/performance/ScorecardSections'
import { getScorecardDetail } from '@/lib/scorecardPayload'
import { routes } from '@/lib/routes'
import '@/styles/performance.css'

export default function ScorecardDetailPage() {
  const { recordId } = useParams<{ recordId: string }>()
  const { records, loading, error } = usePerformanceData()

  if (loading) return <LoadingState />
  if (error) return <div className="pd-alert">{error}</div>
  if (!recordId) return <div className="pd-alert">Missing record ID.</div>

  const record = records.find((r) => r.id === decodeURIComponent(recordId))
  if (!record) {
    return (
      <div className="pd-page">
        <div className="pd-alert">Scorecard record not found.</div>
        <Link to={`${routes.performance.records}?view=scorecards`} className="pd-link">
          ← Back to records
        </Link>
      </div>
    )
  }

  const detail = getScorecardDetail(record)

  return (
    <div className="pd-page">
      <header className="pd-page-header">
        <div>
          <Link to={`${routes.performance.records}?view=scorecards`} className="pd-back-link">
            ← Records
          </Link>
          <h1 className="pd-page-title">{record.employee_name || 'Scorecard'}</h1>
          <p className="pd-page-subtitle">
            {record.cycle_name} · {record.department || 'No department'}
          </p>
        </div>
      </header>

      <div className="pd-panel">
        <ScorecardSections
          detail={detail}
          grades={{
            display: record.display_grade,
            lineManager: record.line_manager_grade,
            calculated: record.calculated_grade,
          }}
        />
      </div>
    </div>
  )
}
