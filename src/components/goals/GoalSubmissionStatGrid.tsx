import { StatCard } from '@/components/performance/StatCard'
import { GOALS_METRIC_HELP } from '@/lib/goalsMetricHelp'
import type { GoalsMonitoringSummary } from '@/lib/goalsMonitoring'

type GoalSubmissionStatGridProps = {
  goalsSummary: GoalsMonitoringSummary
  exportStats: {
    metricRows: number
    uniqueGoals: number
  }
}

export function GoalSubmissionStatGrid({ goalsSummary, exportStats }: GoalSubmissionStatGridProps) {
  const counts = goalsSummary.submissionCounts

  return (
    <div className="pd-stat-grid">
      <StatCard
        label="Total employees"
        value={goalsSummary.totalOwners}
        hint="Active · People directory"
        labelHelp={GOALS_METRIC_HELP.totalEmployees}
      />
      <StatCard
        label="Goals submitted"
        count={counts.submitted.goalCount}
        pct={counts.submitted.pct}
        showProgress
        hint={`${counts.submitted.count.toLocaleString()} ${counts.submitted.count === 1 ? 'person' : 'people'} · ${exportStats.metricRows.toLocaleString()} metrics · ${exportStats.uniqueGoals.toLocaleString()} goals in export`}
        accent="success"
        labelHelp={GOALS_METRIC_HELP.submissionRate}
      />
      <StatCard
        label="Pending submission"
        count={counts.pendingSubmission.count}
        pct={counts.pendingSubmission.pct}
        hint="People"
        accent="warning"
        labelHelp={GOALS_METRIC_HELP.pendingSubmission}
      />
      <StatCard
        label="Awaiting approval"
        count={counts.awaitingApproval.count}
        pct={counts.awaitingApproval.pct}
        hint="People"
        accent="info"
        labelHelp={GOALS_METRIC_HELP.awaitingApproval}
      />
      <StatCard
        label="Approved & locked"
        count={counts.approvedLocked.count}
        pct={counts.approvedLocked.pct}
        showProgress
        hint="People"
        accent="success"
        labelHelp={GOALS_METRIC_HELP.approvedLocked}
      />
      {goalsSummary.quarterDay != null && goalsSummary.quarterDay >= 30 && (
        <StatCard
          label="Overdue (Day 30+)"
          count={counts.overdueDay30NotApproved.count}
          pct={counts.overdueDay30NotApproved.pct}
          hint="People"
          accent="danger"
          labelHelp={GOALS_METRIC_HELP.overdueDay30}
        />
      )}
      <StatCard
        label="Progress update rate"
        pct={goalsSummary.progressUpdateRatePct}
        labelHelp={GOALS_METRIC_HELP.progressUpdateRate}
      />
    </div>
  )
}
