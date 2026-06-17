import { useMemo } from 'react'
import { layoutConfig } from '@/config/layout'
import type { GoalBreakdownRow, GoalsMonitoringSummary } from '@/lib/goalsMonitoring'

type GoalSubmissionTrackerProps = {
  goalsSummary: GoalsMonitoringSummary
  reviewCycleLabel: string | null
}

type BarSegment = {
  count: number
  variant: 'approved' | 'awaiting' | 'pending'
}

function pctOf(count: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((count / total) * 100)
}

function SubmissionStackedBar({
  segments,
  total,
  label,
}: {
  segments: BarSegment[]
  total: number
  label: string
}) {
  if (total <= 0) {
    return (
      <div
        className="pd-submission-tracker__bar pd-submission-tracker__bar--empty"
        role="img"
        aria-label={`${label}: no employees`}
      />
    )
  }

  return (
    <div className="pd-submission-tracker__bar" role="img" aria-label={label}>
      {segments.map((segment) => {
        const width = (segment.count / total) * 100
        if (width <= 0) return null
        return (
          <div
            key={segment.variant}
            className={`pd-submission-tracker__bar-seg pd-submission-tracker__bar-seg--${segment.variant}`}
            style={{ width: `${width}%` }}
          />
        )
      })}
    </div>
  )
}

function TrackerStatCard({
  label,
  value,
  sublabel,
  accent,
}: {
  label: string
  value: string | number
  sublabel: string
  accent?: 'primary' | 'muted' | 'white' | 'approved'
}) {
  const accentClass = accent ? ` pd-submission-tracker__stat--${accent}` : ''
  return (
    <div className={`pd-submission-tracker__stat${accentClass}`}>
      <p className="pd-submission-tracker__stat-label">{label}</p>
      <p className="pd-submission-tracker__stat-value">{value}</p>
      <p className="pd-submission-tracker__stat-sublabel">{sublabel}</p>
    </div>
  )
}

export function GoalSubmissionTracker({
  goalsSummary,
  reviewCycleLabel,
}: GoalSubmissionTrackerProps) {
  const counts = goalsSummary.submissionCounts
  const departmentRows = useMemo(
    () =>
      [...goalsSummary.breakdownByDepartment].sort(
        (a, b) => b.submittedPct - a.submittedPct || a.label.localeCompare(b.label),
      ),
    [goalsSummary.breakdownByDepartment],
  )

  const zeroSubmissionDepartments = useMemo(
    () =>
      departmentRows
        .filter((row) => row.submittedCount === 0)
        .sort((a, b) => b.totalEmployees - a.totalEmployees || a.label.localeCompare(b.label)),
    [departmentRows],
  )

  const zeroSubmissionEmployees = zeroSubmissionDepartments.reduce(
    (sum, row) => sum + row.totalEmployees,
    0,
  )

  const awaitingPctOfSubmitted = pctOf(counts.awaitingApproval.count, counts.submitted.count)
  const approvedPctOfOrg = pctOf(counts.approvedLocked.count, goalsSummary.totalOwners)

  const asOfLabel = new Date().toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const contextLine = [
    layoutConfig.brand.subtitle,
    reviewCycleLabel ? `${reviewCycleLabel} review cycle` : null,
    `as of ${asOfLabel}`,
  ]
    .filter(Boolean)
    .join(' · ')

  const overallSegments: BarSegment[] = [
    { count: counts.approvedLocked.count, variant: 'approved' },
    { count: counts.awaitingApproval.count, variant: 'awaiting' },
    { count: counts.pendingSubmission.count, variant: 'pending' },
  ]

  return (
    <section className="pd-submission-tracker" aria-labelledby="goal-submission-tracker-title">
      <header className="pd-submission-tracker__header">
        <p className="pd-submission-tracker__badge">
          <span className="pd-submission-tracker__badge-dot" aria-hidden />
          Submission tracker
        </p>
        <h2 id="goal-submission-tracker-title" className="pd-submission-tracker__title">
          Org-wide submission status
        </h2>
        <p className="pd-submission-tracker__context">{contextLine}</p>
      </header>

      <div className="pd-submission-tracker__stats">
        <TrackerStatCard
          label="Employees"
          value={goalsSummary.totalOwners.toLocaleString()}
          sublabel={`${departmentRows.length} departments`}
        />
        <TrackerStatCard
          label="Submitted"
          value={counts.submitted.count.toLocaleString()}
          sublabel={`${counts.submitted.pct}% of org`}
          accent="primary"
        />
        <TrackerStatCard
          label="Awaiting approval"
          value={counts.awaitingApproval.count.toLocaleString()}
          sublabel={
            counts.submitted.count > 0
              ? `${awaitingPctOfSubmitted}% of submitted`
              : '0% of submitted'
          }
          accent="muted"
        />
        <TrackerStatCard
          label="Approved"
          value={counts.approvedLocked.count.toLocaleString()}
          sublabel={`${approvedPctOfOrg}% of org`}
          accent="approved"
        />
      </div>

      <div className="pd-submission-tracker__overall">
        <p className="pd-submission-tracker__section-label">Overall progress</p>
        <SubmissionStackedBar
          segments={overallSegments}
          total={goalsSummary.totalOwners}
          label={`Overall progress: ${counts.approvedLocked.count} approved, ${counts.awaitingApproval.count} awaiting approval, ${counts.pendingSubmission.count} not started`}
        />
        <ul className="pd-submission-tracker__legend">
          <li>
            <span className="pd-submission-tracker__legend-swatch pd-submission-tracker__legend-swatch--approved" />
            Approved ({counts.approvedLocked.count.toLocaleString()})
          </li>
          <li>
            <span className="pd-submission-tracker__legend-swatch pd-submission-tracker__legend-swatch--awaiting" />
            Awaiting approval ({counts.awaitingApproval.count.toLocaleString()})
          </li>
          <li>
            <span className="pd-submission-tracker__legend-swatch pd-submission-tracker__legend-swatch--pending" />
            Not started ({counts.pendingSubmission.count.toLocaleString()})
          </li>
        </ul>
      </div>

      <div className="pd-submission-tracker__departments">
        <p className="pd-submission-tracker__section-label">Submission rate by department</p>
        <ul className="pd-submission-tracker__dept-list">
          {departmentRows.map((row) => (
            <DepartmentRow key={row.key} row={row} />
          ))}
        </ul>
      </div>

      {zeroSubmissionDepartments.length > 0 ? (
        <div className="pd-submission-tracker__zero">
          <p className="pd-submission-tracker__zero-title">
            Zero submissions — {zeroSubmissionDepartments.length}{' '}
            {zeroSubmissionDepartments.length === 1 ? 'department' : 'departments'},{' '}
            {zeroSubmissionEmployees.toLocaleString()}{' '}
            {zeroSubmissionEmployees === 1 ? 'employee' : 'employees'}
          </p>
          <div className="pd-submission-tracker__zero-tags">
            {zeroSubmissionDepartments.map((row) => (
              <span key={row.key} className="pd-submission-tracker__zero-tag">
                {row.label} {row.totalEmployees}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function DepartmentRow({ row }: { row: GoalBreakdownRow }) {
  const segments: BarSegment[] = [
    { count: row.approvedCount, variant: 'approved' },
    { count: row.awaitingApprovalCount, variant: 'awaiting' },
    { count: row.pendingSubmissionCount, variant: 'pending' },
  ]

  return (
    <li className="pd-submission-tracker__dept-row">
      <span className="pd-submission-tracker__dept-name" title={row.label}>
        {row.label}
      </span>
      <SubmissionStackedBar
        segments={segments}
        total={row.totalEmployees}
        label={`${row.label}: ${row.approvedCount} approved, ${row.awaitingApprovalCount} awaiting approval, ${row.pendingSubmissionCount} not started`}
      />
      <span className="pd-submission-tracker__dept-pct">{row.submittedPct}%</span>
      <span className="pd-submission-tracker__dept-ratio">
        {row.submittedCount}/{row.totalEmployees}
      </span>
    </li>
  )
}
