import { Link } from 'react-router-dom'
import { routes } from '@/lib/routes'
import { getScorecardDetail } from '@/lib/scorecardPayload'
import { ScorecardSections } from '@/components/performance/ScorecardSections'
import type { PerformanceRecord } from '@/types/performance'

type Props = {
  record: PerformanceRecord | null
  onClose: () => void
}

export function RecordDetailDrawer({ record, onClose }: Props) {
  if (!record) return null

  const detail = getScorecardDetail(record)

  return (
    <>
      <button type="button" className="pd-drawer-backdrop" aria-label="Close" onClick={onClose} />
      <aside className="pd-drawer" role="dialog" aria-labelledby="record-drawer-title">
        <header className="pd-drawer-header">
          <div>
            <h2 id="record-drawer-title" className="pd-drawer-title">
              {record.employee_name || record.employee_id}
            </h2>
            <p className="pd-drawer-subtitle">
              {record.cycle_name || 'Unknown cycle'} · {record.department || 'No department'}
            </p>
          </div>
          <button type="button" className="pd-drawer-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="pd-drawer-body">
          <section className="pd-detail-block">
            <h3 className="pd-detail-heading">Final grades</h3>
            <div className="pd-detail-grid">
              <DetailItem label="Display grade" value={record.display_grade} />
              <DetailItem label="LM grade" value={record.line_manager_grade} />
              <DetailItem label="Calculated" value={record.calculated_grade} />
              <DetailItem label="Absolute rating" value={record.absolute_rating} />
            </div>
          </section>

          <ScorecardSections
            detail={detail}
            grades={{
              display: record.display_grade,
              lineManager: record.line_manager_grade,
              calculated: record.calculated_grade,
            }}
          />

          <Link to={routes.performance.scorecard(record.id)} className="pd-btn pd-drawer-link">
            Open full scorecard view
          </Link>
        </div>
      </aside>
    </>
  )
}

function DetailItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="pd-detail-item">
      <span className="pd-detail-label">{label}</span>
      <span className="pd-detail-value">{value || '—'}</span>
    </div>
  )
}
