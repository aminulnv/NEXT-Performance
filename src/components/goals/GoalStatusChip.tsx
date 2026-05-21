type GoalStatusVariant = 'on-track' | 'complete' | 'at-risk' | 'off-track' | 'default'

const STATUS_VARIANT: Record<string, GoalStatusVariant> = {
  on_track: 'on-track',
  complete: 'complete',
  completed: 'complete',
  at_risk: 'at-risk',
  off_track: 'off-track',
  behind: 'off-track',
  not_started: 'default',
  draft: 'default',
}

export function formatGoalStatusLabel(raw: string): string {
  return raw
    .trim()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

type Props = {
  status: string | null | undefined
}

export function GoalStatusChip({ status }: Props) {
  const value = status?.trim()
  if (!value) return <span className="pd-muted">—</span>

  const key = value.toLowerCase()
  const variant = STATUS_VARIANT[key] ?? 'default'

  return (
    <span className={`pd-badge pd-badge-goal pd-badge-goal--${variant}`}>
      {formatGoalStatusLabel(value)}
    </span>
  )
}
