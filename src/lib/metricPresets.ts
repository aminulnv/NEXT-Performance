import type { MetricViewConfig } from '@/types/performance'

export type MetricPreset = {
  id: string
  name: string
  description: string
  config: MetricViewConfig
}

export const METRIC_PRESETS: MetricPreset[] = [
  {
    id: 'by-department',
    name: 'By department',
    description: 'Count records grouped by department',
    config: { groupBy: 'department', metricType: 'count' },
  },
  {
    id: 'by-cycle',
    name: 'By cycle',
    description: 'Count records grouped by review cycle',
    config: { groupBy: 'cycle', metricType: 'count' },
  },
  {
    id: 'by-grade',
    name: 'By display grade',
    description: 'Grade distribution across all records',
    config: { groupBy: 'display_grade', metricType: 'grade_distribution' },
  },
  {
    id: 'by-team',
    name: 'By team',
    description: 'Count records grouped by team',
    config: { groupBy: 'team', metricType: 'count' },
  },
  {
    id: 'dept-grades',
    name: 'Department grade mix',
    description: 'Display grade breakdown (use department filter below)',
    config: { groupBy: 'display_grade', metricType: 'grade_distribution' },
  },
]
