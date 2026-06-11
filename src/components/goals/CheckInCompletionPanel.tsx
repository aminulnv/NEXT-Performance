import { GoalStatusChip } from '@/components/goals/GoalStatusChip'
import { PersonAvatar } from '@/components/performance/PersonAvatar'
import { StatCard } from '@/components/performance/StatCard'
import { ScrollableTableViewport } from '@/components/performance/ScrollableTableViewport'
import { GOALS_METRIC_HELP } from '@/lib/goalsMetricHelp'
import {
  employeeToFlagPersonRow,
  type GoalOwnerProfileLookup,
} from '@/lib/goalOwnerProfiles'
import type { CheckInMonitoringSummary, CheckInOwnerRow } from '@/lib/goalsMonitoring'
type Props = {
  summary: CheckInMonitoringSummary
  ownerProfileLookup: GoalOwnerProfileLookup
}

function ownerRow(
  row: CheckInOwnerRow,
  lookup: GoalOwnerProfileLookup,
) {
  return employeeToFlagPersonRow(
    {
      owner: row.owner,
      ownerFullName: row.ownerFullName,
      employeeId: null,
      department: null,
      team: null,
      location: null,
      lineManagerKey: '__unknown_line_manager__',
      lineManagerName: 'Unknown line manager',
      lineManagerId: null,
      lineManagerEmail: null,
      reviewCycle: row.priorReviewCycle,
      employeeGoalCount: row.openGoals.length,
      submittedGoalCount: row.openGoals.length,
      submitted: true,
      fullyApproved: false,
      hasPendingApproval: false,
      hasProgressUpdate: false,
      goals: [],
    },
    lookup,
  )
}

export function CheckInCompletionPanel({ summary, ownerProfileLookup }: Props) {
  const deadlineLabel = `Day 15 of ${summary.monitoringQuarterLabel}`
  const listLabel = `Employees needing check-in for ${summary.priorQuarterLabel}`

  return (
    <div className="pd-check-in-panel">
      <div className="pd-stat-grid">
        <StatCard
          label="Check-in completion rate"
          value={`${summary.completionRatePct}%`}
          hint={`${summary.ownersWithPriorGoals} with goals in ${summary.priorQuarterLabel}`}
          labelHelp={GOALS_METRIC_HELP.checkInCompletionRate}
        />
        <StatCard
          label="Still open from prior quarter"
          value={summary.needingCheckIn.length}
          hint={`Mark complete by ${deadlineLabel}`}
        />
        {summary.pastDay15 && (
          <StatCard
            label="Overdue after Day 15"
            value={summary.overdueAfterDay15.length}
            hint={deadlineLabel}
          />
        )}
      </div>

      {summary.needingCheckIn.length === 0 ? (
        <p className="pd-page-subtitle">
          Everyone with {summary.priorQuarterLabel} employee goals has marked them complete.
        </p>
      ) : (
        <div className="pd-panel pd-check-in-list-panel">
          <ScrollableTableViewport className="pd-scroll-list--tall" label={listLabel}>
            <table className="pd-table pd-check-in-table">
              <thead>
                <tr>
                  <th className="pd-check-in-table__avatar-col" scope="col">
                    <span className="pd-sr-only">Avatar</span>
                  </th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Prior quarter</th>
                  <th>Open goals</th>
                  <th>Status</th>
                  <th>Deadline</th>
                </tr>
              </thead>
              <tbody>
                {summary.needingCheckIn.map((row) => {
                  const person = ownerRow(row, ownerProfileLookup)
                  const status = summary.pastDay15 ? (
                    <span className="pd-badge pd-badge-warn">Overdue</span>
                  ) : (
                    <span className="pd-badge">Due by Day 15</span>
                  )
                  return (
                    <tr key={row.owner}>
                      <td className="pd-check-in-table__avatar-col">
                        <PersonAvatar name={person.name} avatarUrl={person.avatarUrl} size={32} />
                      </td>
                      <td>{person.name}</td>
                      <td className="pd-muted">{person.department}</td>
                      <td>{row.priorReviewCycle}</td>
                      <td>
                        <ul className="pd-check-in-goal-list">
                          {row.openGoals.map((g) => (
                            <li key={g.goalId}>
                              {g.title ?? `Goal ${g.goalId}`}{' '}
                              <GoalStatusChip status={g.goalStatus} />
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td>
                        <span className="pd-badge pd-badge-warn">Not complete</span>
                      </td>
                      <td>{status}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </ScrollableTableViewport>
        </div>
      )}
    </div>
  )
}
