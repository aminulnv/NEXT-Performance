import { Link, useParams } from 'react-router-dom'
import { usePerformanceData } from '@/hooks/usePerformanceData'
import { useGoalsData, goalsForEmployee } from '@/hooks/useGoalsData'
import { LoadingState } from '@/components/performance/LoadingState'
import { getRecordsForEmployee } from '@/lib/metrics'
import { routes } from '@/lib/routes'
import '@/styles/performance.css'

export default function PersonDetailPage() {
  const { employeeId } = useParams<{ employeeId: string }>()
  const { records, loading, error } = usePerformanceData()
  const { goals, loading: goalsLoading } = useGoalsData()
  const personGoals = employeeId ? goalsForEmployee(goals, employeeId) : []

  if (loading || goalsLoading) return <LoadingState />
  if (error) return <div className="pd-alert">{error}</div>
  if (!employeeId) return <div className="pd-alert">Missing employee ID.</div>

  const history = getRecordsForEmployee(records, decodeURIComponent(employeeId))
  const name = history[0]?.employee_name ?? employeeId

  return (
    <div className="pd-page">
      <header className="pd-page-header">
        <div>
          <Link to={routes.organization.people} className="pd-back-link">
            ← People
          </Link>
          <h1 className="pd-page-title">{name}</h1>
          <p className="pd-page-subtitle">
            {history.length} review cycle{history.length === 1 ? '' : 's'}
          </p>
        </div>
      </header>

      {personGoals.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 className="pd-section-title">Goals (CSV import)</h2>
          <div className="pd-panel pd-table-wrap">
            <table className="pd-table">
              <thead>
                <tr>
                  <th>Cycle</th>
                  <th>Goal</th>
                  <th>Status</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {personGoals.map((g) => (
                  <tr key={g.id}>
                    <td>{g.cycle_name ?? '—'}</td>
                    <td>{g.title ?? '—'}</td>
                    <td>{g.status ?? '—'}</td>
                    <td>{g.progress ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {history.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No performance records for this person.</p>
      ) : (
        <div className="pd-panel pd-table-wrap">
          <table className="pd-table">
            <thead>
              <tr>
                <th>Cycle</th>
                <th>Department</th>
                <th>Team</th>
                <th>Display grade</th>
                <th>LM grade</th>
                <th>Calculated</th>
                <th>Scorecard</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id}>
                  <td>{r.cycle_name || '—'}</td>
                  <td>{r.department || '—'}</td>
                  <td>{r.team || '—'}</td>
                  <td>
                    <span className="pd-badge">{r.display_grade || '—'}</span>
                  </td>
                  <td>{r.line_manager_grade || '—'}</td>
                  <td>{r.calculated_grade || '—'}</td>
                  <td>
                    <Link to={routes.performance.scorecard(r.id)} className="pd-link">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
