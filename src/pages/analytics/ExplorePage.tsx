import { useMemo, useState } from 'react'
import { usePerformanceData } from '@/hooks/usePerformanceData'
import { buildDashboardSummary, filterRecords, groupRecords, uniqueFieldValues } from '@/lib/metrics'
import { METRIC_PRESETS } from '@/lib/metricPresets'
import type { MetricViewConfig } from '@/types/performance'
import { GroupedCountChart } from '@/components/performance/GroupedCountChart'
import { GradeDistribution } from '@/components/performance/GradeDistribution'
import { LoadingState } from '@/components/performance/LoadingState'
import { EmptyState } from '@/components/performance/EmptyState'
import '@/styles/performance.css'

const GROUP_BY_LABELS: Record<NonNullable<MetricViewConfig['groupBy']>, string> = {
  department: 'Department',
  cycle: 'Cycle',
  display_grade: 'Display grade',
  team: 'Team',
}

const defaultConfig: MetricViewConfig = {
  groupBy: 'department',
  metricType: 'count',
}

function describeActiveConfig(config: MetricViewConfig): string {
  const parts: string[] = []
  if (config.cycleFilter) parts.push(`cycle: ${config.cycleFilter}`)
  if (config.departmentFilter) parts.push(`dept: ${config.departmentFilter}`)
  if (config.teamFilter) parts.push(`team: ${config.teamFilter}`)
  if (config.gradeFilter) parts.push(`grade: ${config.gradeFilter}`)
  parts.push(`group by ${GROUP_BY_LABELS[config.groupBy ?? 'department']}`)
  if (config.metricType === 'grade_distribution') parts.push('grade distribution')
  return parts.join(' · ')
}

function hasActiveFilters(config: MetricViewConfig): boolean {
  return Boolean(
    config.cycleFilter ||
      config.departmentFilter ||
      config.teamFilter ||
      config.gradeFilter,
  )
}

export default function ExplorePage() {
  const { records, loading, error, reload } = usePerformanceData()
  const [config, setConfig] = useState<MetricViewConfig>(defaultConfig)

  const cycles = useMemo(() => uniqueFieldValues(records, 'cycle_name'), [records])
  const departments = useMemo(() => uniqueFieldValues(records, 'department'), [records])
  const teams = useMemo(() => uniqueFieldValues(records, 'team'), [records])
  const grades = useMemo(() => uniqueFieldValues(records, 'display_grade'), [records])

  const filteredRecords = useMemo(() => filterRecords(records, config), [records, config])
  const groupedRows = useMemo(
    () => groupRecords(filteredRecords, config.groupBy),
    [filteredRecords, config.groupBy],
  )
  const gradeDistribution = useMemo(
    () => buildDashboardSummary(filteredRecords).gradeDistribution,
    [filteredRecords],
  )

  const totalCount = groupedRows.reduce((sum, row) => sum + row.count, 0)
  const showGradeDistribution = config.metricType === 'grade_distribution'

  function updateConfig(patch: Partial<MetricViewConfig>) {
    setConfig((current) => ({ ...current, ...patch }))
  }

  if (loading) return <LoadingState />
  if (error) return <div className="pd-alert">{error}</div>

  return (
    <div className="pd-page">
      <header className="pd-page-header">
        <div>
          <h1 className="pd-page-title">Explore</h1>
          <p className="pd-page-subtitle">
            Adjust filters and grouping to analyze performance data — results update instantly.
          </p>
        </div>
        {hasActiveFilters(config) ? (
          <button
            type="button"
            className="pd-btn-secondary pd-btn"
            onClick={() => setConfig(defaultConfig)}
          >
            Reset filters
          </button>
        ) : null}
      </header>

      <section className="pd-panel">
        <h2 className="pd-panel-title">Quick presets</h2>
        <p className="pd-page-hint" style={{ marginTop: 0 }}>
          Jump to a common layout, then tweak filters below.
        </p>
        <div className="pd-preset-grid">
          {METRIC_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="pd-preset-card"
              onClick={() => setConfig(preset.config)}
            >
              <strong>{preset.name}</strong>
              <span>{preset.description}</span>
            </button>
          ))}
        </div>
      </section>

      {records.length === 0 ? (
        <EmptyState
          title="No data for metrics"
          description="Refresh performance records from the Revolut API first."
          onRefresh={reload}
        />
      ) : (
        <>
          <section className="pd-panel pd-master-filters">
            <h2 className="pd-panel-title">Filters &amp; grouping</h2>
            <div className="pd-filter-grid">
              <div className="pd-form-row">
                <label className="pd-label" htmlFor="explorer-cycle">
                  Cycle
                </label>
                <select
                  id="explorer-cycle"
                  className="pd-select"
                  value={config.cycleFilter ?? ''}
                  onChange={(e) =>
                    updateConfig({ cycleFilter: e.target.value || undefined })
                  }
                >
                  <option value="">All cycles</option>
                  {cycles.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pd-form-row">
                <label className="pd-label" htmlFor="explorer-dept">
                  Department
                </label>
                <select
                  id="explorer-dept"
                  className="pd-select"
                  value={config.departmentFilter ?? ''}
                  onChange={(e) =>
                    updateConfig({ departmentFilter: e.target.value || undefined })
                  }
                >
                  <option value="">All departments</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pd-form-row">
                <label className="pd-label" htmlFor="explorer-team">
                  Team
                </label>
                <select
                  id="explorer-team"
                  className="pd-select"
                  value={config.teamFilter ?? ''}
                  onChange={(e) => updateConfig({ teamFilter: e.target.value || undefined })}
                >
                  <option value="">All teams</option>
                  {teams.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pd-form-row">
                <label className="pd-label" htmlFor="explorer-grade">
                  Display grade
                </label>
                <select
                  id="explorer-grade"
                  className="pd-select"
                  value={config.gradeFilter ?? ''}
                  onChange={(e) =>
                    updateConfig({ gradeFilter: e.target.value || undefined })
                  }
                >
                  <option value="">All grades</option>
                  {grades.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pd-form-row">
                <label className="pd-label" htmlFor="explorer-group">
                  Group by
                </label>
                <select
                  id="explorer-group"
                  className="pd-select"
                  value={config.groupBy ?? 'department'}
                  onChange={(e) =>
                    updateConfig({
                      groupBy: e.target.value as MetricViewConfig['groupBy'],
                    })
                  }
                >
                  <option value="department">Department</option>
                  <option value="cycle">Cycle</option>
                  <option value="display_grade">Display grade</option>
                  <option value="team">Team</option>
                </select>
              </div>
              <div className="pd-form-row">
                <label className="pd-label" htmlFor="explorer-view">
                  View
                </label>
                <select
                  id="explorer-view"
                  className="pd-select"
                  value={config.metricType ?? 'count'}
                  onChange={(e) =>
                    updateConfig({
                      metricType: e.target.value as MetricViewConfig['metricType'],
                    })
                  }
                >
                  <option value="count">Count by group</option>
                  <option value="grade_distribution">Grade distribution</option>
                </select>
              </div>
            </div>
            <p className="pd-page-hint" style={{ margin: '0.75rem 0 0' }}>
              {totalCount} records · {groupedRows.length} groups · {describeActiveConfig(config)}
            </p>
          </section>

          <div className="pd-grid-2">
            <div className="pd-panel">
              {showGradeDistribution ? (
                <GradeDistribution
                  data={gradeDistribution}
                  title="Grade distribution (filtered)"
                />
              ) : (
                <GroupedCountChart
                  rows={groupedRows}
                  title={`By ${GROUP_BY_LABELS[config.groupBy ?? 'department']}`}
                />
              )}
            </div>

            <div className="pd-panel">
              <h2 className="pd-panel-title">Breakdown</h2>
              <div className="pd-table-wrap">
                <table className="pd-table">
                  <thead>
                    <tr>
                      <th>Group</th>
                      <th>Count</th>
                      <th>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedRows.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ color: '#6b7280' }}>
                          No records match the current filters.
                        </td>
                      </tr>
                    ) : (
                      groupedRows.map((row) => (
                        <tr key={row.key}>
                          <td>{row.key}</td>
                          <td>{row.count}</td>
                          <td>
                            {totalCount > 0
                              ? `${Math.round((row.count / totalCount) * 100)}%`
                              : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {showGradeDistribution && config.groupBy !== 'display_grade' ? (
            <div className="pd-panel">
              <GroupedCountChart
                rows={groupedRows}
                title={`Count by ${GROUP_BY_LABELS[config.groupBy ?? 'department']}`}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
