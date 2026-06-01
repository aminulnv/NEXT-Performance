import { MetricTermLabel } from '@/components/performance/MetricInfo'

type StatCardAccent = 'success' | 'warning' | 'danger' | 'info'

type StatCardProps = {
  label: string
  value?: string | number
  count?: number
  pct?: number
  showProgress?: boolean
  hint?: string
  labelHelp?: string
  accent?: StatCardAccent
}

export function StatCard({ label, value, count, pct, showProgress, hint, labelHelp, accent }: StatCardProps) {
  const hasSplitLayout = count !== undefined
  const isPctOnly = pct !== undefined && count === undefined && value === undefined
  const accentClass = accent ? ` pd-stat-card--${accent}` : ''

  return (
    <div className={`pd-stat-card${accentClass}`}>
      <p className="pd-stat-label">
        {labelHelp ? <MetricTermLabel label={label} help={labelHelp} /> : label}
      </p>

      {hasSplitLayout ? (
        <div className="pd-stat-body">
          <p className="pd-stat-value">{count}</p>
          {pct !== undefined && <span className="pd-stat-pct-chip">{pct}%</span>}
        </div>
      ) : isPctOnly ? (
        <p className="pd-stat-value">{pct}%</p>
      ) : (
        <p className="pd-stat-value">{value}</p>
      )}

      {showProgress && pct !== undefined && (
        <div className="pd-stat-progress" role="presentation">
          <div
            className="pd-stat-progress-fill"
            style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
          />
        </div>
      )}

      {hint ? <p className="pd-stat-hint">{hint}</p> : null}
    </div>
  )
}
