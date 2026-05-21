import { MetricTermLabel } from '@/components/performance/MetricInfo'

type StatCardProps = {
  label: string
  value: string | number
  hint?: string
  labelHelp?: string
}

export function StatCard({ label, value, hint, labelHelp }: StatCardProps) {
  return (
    <div className="pd-stat-card">
      <p className="pd-stat-label">
        {labelHelp ? <MetricTermLabel label={label} help={labelHelp} /> : label}
      </p>
      <p className="pd-stat-value">{value}</p>
      {hint ? <p className="pd-stat-hint">{hint}</p> : null}
    </div>
  )
}
