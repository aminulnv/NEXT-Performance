import type { GradeBucket } from '@/types/performance'

type Props = {
  data: GradeBucket[]
  title?: string
}

export function GradeDistribution({ data, title = 'Grade distribution' }: Props) {
  const max = Math.max(...data.map((d) => d.count), 1)

  return (
    <div className="pd-panel">
      <h2 className="pd-panel-title">{title}</h2>
      {data.length === 0 ? (
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>No data yet.</p>
      ) : (
        data.map((row) => (
          <div key={row.label} className="pd-bar-row">
            <span className="pd-bar-label" title={row.label}>
              {row.label}
            </span>
            <div className="pd-bar-track">
              <div
                className="pd-bar-fill"
                style={{ width: `${(row.count / max) * 100}%` }}
              />
            </div>
            <span className="pd-bar-count">
              {row.count} ({row.pct}%)
            </span>
          </div>
        ))
      )}
    </div>
  )
}
