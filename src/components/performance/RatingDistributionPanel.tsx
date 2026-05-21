import {
  buildGradeComparison,
  PTR_GRADE_TARGETS,
  type GradeComparisonRow,
} from '@/lib/goalsMonitoring'
import type { GradeBucket } from '@/types/performance'

type OutlierDepartment = {
  department: string
  count: number
  distribution: GradeBucket[]
  maxSkewPct: number
}

type Props = {
  distribution: GradeBucket[]
  outlierDepartments: OutlierDepartment[]
}

const GRADE_STYLE: Record<string, { chip: string; bar: string }> = {
  Exceptional: { chip: 'pd-grade-chip--exceptional', bar: 'pd-grade-bar--exceptional' },
  Exceeding: { chip: 'pd-grade-chip--exceeding', bar: 'pd-grade-bar--exceeding' },
  Performing: { chip: 'pd-grade-chip--performing', bar: 'pd-grade-bar--performing' },
  Developing: { chip: 'pd-grade-chip--developing', bar: 'pd-grade-bar--developing' },
  Unsatisfactory: { chip: 'pd-grade-chip--unsatisfactory', bar: 'pd-grade-bar--unsatisfactory' },
}

function gradeStyles(label: string) {
  return GRADE_STYLE[label] ?? { chip: 'pd-grade-chip--default', bar: 'pd-grade-bar--default' }
}

function formatGap(gap: number): string {
  if (gap > 0) return `+${gap}%`
  if (gap < 0) return `${gap}%`
  return '0%'
}

function gapSeverity(gap: number): 'ok' | 'warn' | 'alert' {
  const abs = Math.abs(gap)
  if (abs >= 25) return 'alert'
  if (abs >= 10) return 'warn'
  return 'ok'
}

function ActualCountCell({ pct, count }: { pct: number; count: number }) {
  return (
    <span className="pd-rating-compare-num">
      {pct}% <span className="pd-muted">({count})</span>
    </span>
  )
}

function ComparisonRowVisual({ row }: { row: GradeComparisonRow }) {
  const severity = gapSeverity(row.gap)
  const styles = gradeStyles(row.label)
  return (
    <tr>
      <td>
        <span className={`pd-grade-chip ${styles.chip}`}>{row.label}</span>
      </td>
      <td>
        <ActualCountCell pct={row.actualPct} count={row.actualCount} />
      </td>
      <td className="pd-rating-compare-num">{row.targetPct}%</td>
      <td>
        <div className="pd-rating-compare-bar-wrap" title={`Actual ${row.actualPct}% · Target ${row.targetPct}%`}>
          <div className="pd-rating-compare-track">
            <div
              className="pd-rating-compare-target"
              style={{ left: `${row.targetPct}%` }}
              aria-hidden
            />
            <div
              className={`pd-rating-compare-actual ${styles.bar}`}
              style={{ width: `${Math.min(row.actualPct, 100)}%` }}
            />
          </div>
        </div>
      </td>
      <td>
        <span className={`pd-rating-gap pd-rating-gap--${severity}`}>{formatGap(row.gap)}</span>
      </td>
    </tr>
  )
}

type TeamSkewRow = {
  department: string
  count: number
  maxSkewPct: number
  label: string
  actualPct: number
  actualCount: number
  targetPct: number
  gap: number
  isFirstInDept: boolean
  deptRowSpan: number
}

function problemGradesForTeam(team: OutlierDepartment): GradeComparisonRow[] {
  return buildGradeComparison(team.distribution)
    .filter((r) => PTR_GRADE_TARGETS[r.label] != null)
    .filter((r) => Math.abs(r.gap) >= 15 || r.actualPct >= 50)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
}

function buildCombinedTeamRows(teams: OutlierDepartment[]): TeamSkewRow[] {
  const rows: TeamSkewRow[] = []
  for (const team of teams) {
    const grades = problemGradesForTeam(team)
    grades.forEach((grade, index) => {
      rows.push({
        department: team.department,
        count: team.count,
        maxSkewPct: team.maxSkewPct,
        label: grade.label,
        actualPct: grade.actualPct,
        actualCount: grade.actualCount,
        targetPct: grade.targetPct,
        gap: grade.gap,
        isFirstInDept: index === 0,
        deptRowSpan: grades.length,
      })
    })
  }
  return rows
}

function TeamsSkewTable({ teams }: { teams: OutlierDepartment[] }) {
  const rows = buildCombinedTeamRows(teams)

  return (
    <div className="pd-panel pd-team-skew-combined">
      <h3 className="pd-panel-title">Teams off target curve</h3>
      <div className="pd-table-wrap">
        <table className="pd-table pd-rating-compare-table">
          <thead>
            <tr>
              <th>Department</th>
              <th>Rated</th>
              <th>Grade</th>
              <th>Actual % (count)</th>
              <th>Target</th>
              <th>Gap</th>
              <th>Max gap</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.department}-${row.label}`}>
                {row.isFirstInDept && (
                  <>
                    <td rowSpan={row.deptRowSpan} className="pd-team-skew-dept">
                      <strong>{row.department}</strong>
                    </td>
                    <td rowSpan={row.deptRowSpan} className="pd-rating-compare-num">
                      {row.count}
                    </td>
                  </>
                )}
                <td>
                  <span className={`pd-grade-chip ${gradeStyles(row.label).chip}`}>
                    {row.label}
                  </span>
                </td>
                <td>
                  <ActualCountCell pct={row.actualPct} count={row.actualCount} />
                </td>
                <td className="pd-rating-compare-num">{row.targetPct}%</td>
                <td>
                  <span className={`pd-rating-gap pd-rating-gap--${gapSeverity(row.gap)}`}>
                    {formatGap(row.gap)}
                  </span>
                </td>
                {row.isFirstInDept && (
                  <td rowSpan={row.deptRowSpan} className="pd-rating-compare-num">
                    {row.maxSkewPct} pts
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function RatingDistributionPanel({ distribution, outlierDepartments }: Props) {
  const rows = buildGradeComparison(distribution).filter(
    (r) => PTR_GRADE_TARGETS[r.label] != null,
  )

  return (
    <div className="pd-rating-distribution">
      <div className="pd-panel">
        <div className="pd-table-wrap">
          <table className="pd-table pd-rating-compare-table">
            <thead>
              <tr>
                <th>Grade</th>
                <th>Actual % (count)</th>
                <th>Target</th>
                <th style={{ minWidth: '12rem' }}>Visual</th>
                <th>Gap</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <ComparisonRowVisual key={row.label} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {outlierDepartments.length > 0 && <TeamsSkewTable teams={outlierDepartments} />}
    </div>
  )
}
