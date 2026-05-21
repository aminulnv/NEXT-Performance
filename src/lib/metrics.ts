import type {
  CalibrationRow,
  DashboardSummary,
  DepartmentSummary,
  EmployeeSummary,
  GradeBucket,
  MasterFilters,
  MetricViewConfig,
  PerformanceRecord,
} from '@/types/performance'
import { getScorecardDetail, hasScorecardData, parseAlternateScorecards } from '@/lib/scorecardPayload'

const GRADE_ORDER = [
  'Exceptional',
  'Exceeding',
  'Performing',
  'Developing',
  'Unsatisfactory',
]

function uniqueSorted(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.map((v) => (v ?? '').trim()).filter(Boolean))].sort()
}

export function filterRecords(
  records: PerformanceRecord[],
  config: MetricViewConfig,
): PerformanceRecord[] {
  return records.filter((r) => {
    if (config.cycleFilter && r.cycle_name !== config.cycleFilter) return false
    if (config.departmentFilter && r.department !== config.departmentFilter) return false
    if (config.teamFilter && r.team !== config.teamFilter) return false
    if (config.gradeFilter && r.display_grade !== config.gradeFilter) return false
    return true
  })
}

function recordSearchHaystack(record: PerformanceRecord): string {
  const detail = getScorecardDetail(record)
  const deliverables = detail.sections.find((s) => s.title === 'Deliverables')
  const values = detail.sections.find((s) => s.title === 'Values')
  const skills = detail.sections.find((s) => s.title === 'Skills')
  return [
    record.employee_name,
    record.employee_id,
    record.cycle_id,
    record.department,
    record.team,
    record.cycle_name,
    record.display_grade,
    record.line_manager_grade,
    record.calculated_grade,
    record.absolute_rating,
    detail.reviewer,
    detail.relation,
    detail.status,
    deliverables?.rating,
    values?.rating,
    skills?.rating,
    detail.reviewOverallRating,
    detail.overallRating,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function applyMasterFilters(
  records: PerformanceRecord[],
  filters: MasterFilters,
): PerformanceRecord[] {
  const q = filters.search?.trim().toLowerCase() ?? ''
  return records.filter((r) => {
    if (filters.cycle && r.cycle_name !== filters.cycle) return false
    if (filters.department && r.department !== filters.department) return false
    if (filters.team && r.team !== filters.team) return false
    if (filters.displayGrade && r.display_grade !== filters.displayGrade) return false
    if (filters.lineManagerGrade && r.line_manager_grade !== filters.lineManagerGrade) return false
    if (!q) return true
    return recordSearchHaystack(r).includes(q)
  })
}

export function uniqueFieldValues(
  records: PerformanceRecord[],
  field: keyof Pick<
    PerformanceRecord,
    'cycle_name' | 'department' | 'team' | 'display_grade' | 'line_manager_grade'
  >,
): string[] {
  return uniqueSorted(records.map((r) => r[field] as string | null | undefined))
}

export function buildDashboardSummary(records: PerformanceRecord[]): DashboardSummary {
  const employees = new Set(records.map((r) => r.employee_id).filter(Boolean))
  const grades = records.map((r) => r.display_grade || 'Unknown')
  const total = grades.length || 1

  const gradeCounts = new Map<string, number>()
  for (const g of grades) {
    gradeCounts.set(g, (gradeCounts.get(g) ?? 0) + 1)
  }

  const gradeDistribution: GradeBucket[] = []
  const orderedLabels = [
    ...GRADE_ORDER.filter((l) => gradeCounts.has(l)),
    ...[...gradeCounts.keys()].filter((k) => !GRADE_ORDER.includes(k)).sort(),
  ]

  for (const label of orderedLabels) {
    const count = gradeCounts.get(label) ?? 0
    gradeDistribution.push({
      label,
      count,
      pct: Math.round((count / total) * 100),
    })
  }

  const deptMap = new Map<string, number>()
  for (const r of records) {
    const d = r.department || 'Unknown'
    deptMap.set(d, (deptMap.get(d) ?? 0) + 1)
  }

  const cycleMap = new Map<string, number>()
  for (const r of records) {
    const c = r.cycle_name || 'Unknown'
    cycleMap.set(c, (cycleMap.get(c) ?? 0) + 1)
  }

  const { withScorecard: recordsWithScorecard } = countRecordsWithScorecardTiming(records)

  return {
    totalEmployees: employees.size,
    totalRecords: records.length,
    recordsWithScorecard,
    cycles: uniqueSorted(records.map((r) => r.cycle_name)),
    departments: uniqueSorted(records.map((r) => r.department)),
    gradeDistribution,
    byDepartment: [...deptMap.entries()]
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count),
    byCycle: [...cycleMap.entries()]
      .map(([cycle, count]) => ({ cycle, count }))
      .sort((a, b) => b.count - a.count),
    lastSyncedAt: null,
  }
}

export function groupRecords(
  records: PerformanceRecord[],
  groupBy: MetricViewConfig['groupBy'],
): { key: string; count: number; records: PerformanceRecord[] }[] {
  const field =
    groupBy === 'department'
      ? 'department'
      : groupBy === 'cycle'
        ? 'cycle_name'
        : groupBy === 'team'
          ? 'team'
          : 'display_grade'

  const map = new Map<string, PerformanceRecord[]>()
  for (const r of records) {
    const key = String((r as Record<string, unknown>)[field] ?? 'Unknown')
    const list = map.get(key) ?? []
    list.push(r)
    map.set(key, list)
  }

  return [...map.entries()]
    .map(([key, list]) => ({ key, count: list.length, records: list }))
    .sort((a, b) => b.count - a.count)
}

const LINE_MANAGER_NAME_KEYS = ['Line Manager (HR profile)', 'Line Manager (cycle)']

function lineManagerNameFromRecord(record: PerformanceRecord | null): string | null {
  if (!record?.payload) return null
  for (const key of LINE_MANAGER_NAME_KEYS) {
    const value = record.payload[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function latestRecord(records: PerformanceRecord[]): PerformanceRecord | null {
  if (!records.length) return null
  return [...records].sort((a, b) => {
    const cycleCmp = (b.cycle_name ?? '').localeCompare(a.cycle_name ?? '')
    if (cycleCmp !== 0) return cycleCmp
    return b.synced_at.localeCompare(a.synced_at)
  })[0]
}

export function dedupeEmployees(records: PerformanceRecord[]): EmployeeSummary[] {
  const byEmployee = new Map<string, PerformanceRecord[]>()
  for (const r of records) {
    const id = r.employee_id ?? r.employee_name ?? r.id
    const list = byEmployee.get(id) ?? []
    list.push(r)
    byEmployee.set(id, list)
  }

  return [...byEmployee.entries()]
    .map(([employeeId, empRecords]) => {
      const latest = latestRecord(empRecords)
      return {
        employeeId,
        employeeName: latest?.employee_name ?? employeeId,
        department: latest?.department ?? null,
        team: latest?.team ?? null,
        lineManagerName: lineManagerNameFromRecord(latest),
        cyclesCount: new Set(empRecords.map((r) => r.cycle_name).filter(Boolean)).size,
        latestCycle: latest?.cycle_name ?? null,
        latestDisplayGrade: latest?.display_grade ?? null,
        latestLineManagerGrade: latest?.line_manager_grade ?? null,
        records: empRecords,
      }
    })
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
}

export function getRecordsForEmployee(
  records: PerformanceRecord[],
  employeeId: string,
): PerformanceRecord[] {
  return records
    .filter((r) => (r.employee_id ?? r.employee_name ?? r.id) === employeeId)
    .sort((a, b) => (b.cycle_name ?? '').localeCompare(a.cycle_name ?? ''))
}

export function buildDepartmentSummaries(
  records: PerformanceRecord[],
  cycleFilter?: string,
): DepartmentSummary[] {
  const subset = cycleFilter
    ? records.filter((r) => r.cycle_name === cycleFilter)
    : records

  const byDept = new Map<string, PerformanceRecord[]>()
  for (const r of subset) {
    const d = r.department || 'Unknown'
    const list = byDept.get(d) ?? []
    list.push(r)
    byDept.set(d, list)
  }

  return [...byDept.entries()]
    .map(([department, deptRecords]) => {
      const summary = buildDashboardSummary(deptRecords)
      const teamMap = new Map<string, number>()
      for (const r of deptRecords) {
        const t = r.team || 'Unknown'
        teamMap.set(t, (teamMap.get(t) ?? 0) + 1)
      }
      return {
        department,
        employeeCount: summary.totalEmployees,
        recordCount: summary.totalRecords,
        cyclesCount: new Set(deptRecords.map((r) => r.cycle_name).filter(Boolean)).size,
        gradeDistribution: summary.gradeDistribution,
        teams: [...teamMap.entries()]
          .map(([team, count]) => ({ team, count }))
          .sort((a, b) => b.count - a.count),
      }
    })
    .sort((a, b) => b.recordCount - a.recordCount)
}

export function buildCalibrationRows(records: PerformanceRecord[]): CalibrationRow[] {
  return records.map((r) => {
    const p = r.payload ?? {}
    const flags = p['Calibration Flags']
    return {
      recordId: r.id,
      employeeName: r.employee_name,
      cycleName: r.cycle_name,
      department: r.department,
      displayGrade: r.display_grade,
      lineManagerGrade: r.line_manager_grade,
      calculatedGrade: r.calculated_grade,
      departmentCalibrator: p['Department Grade Calibrator'] != null ? String(p['Department Grade Calibrator']) : null,
      functionCalibrator: p['Function Grade Calibrator'] != null ? String(p['Function Grade Calibrator']) : null,
      gradeCalibrated: p['Grade Calibrated'] != null ? String(p['Grade Calibrated']) : null,
      calibrationFlags: flags != null && String(flags).trim() ? String(flags) : null,
    }
  })
}

export function countRecordsWithScorecardTiming(records: PerformanceRecord[]): {
  withScorecard: number
  withTiming: number
} {
  let withScorecard = 0
  let withTiming = 0
  for (const r of records) {
    if (hasScorecardData(r)) withScorecard++
    const opened = r.payload?.['Scorecard Opened Date Time']
    const completed = r.payload?.['Scorecard Completed Date Time']
    if (opened && completed) withTiming++
  }
  return { withScorecard, withTiming }
}

export function countAllScorecardsEmbedded(records: PerformanceRecord[]): {
  recordsWithList: number
  totalScorecards: number
} {
  let recordsWithList = 0
  let totalScorecards = 0
  for (const r of records) {
    const alts = parseAlternateScorecards(r.payload ?? {})
    if (alts.length) {
      recordsWithList++
      totalScorecards += alts.length
    }
  }
  return { recordsWithList, totalScorecards }
}
