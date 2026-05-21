export type PerformanceRecord = {
  id: string
  sync_run_id: string | null
  grade_record_id: string | null
  employee_id: string | null
  cycle_id: string | null
  employee_name: string | null
  cycle_name: string | null
  department: string | null
  team: string | null
  display_grade: string | null
  line_manager_grade: string | null
  calculated_grade: string | null
  absolute_rating: string | null
  ranking_score: number | null
  payload: Record<string, unknown>
  synced_at: string
}

export type MetricViewConfig = {
  cycleFilter?: string
  departmentFilter?: string
  teamFilter?: string
  gradeFilter?: string
  groupBy?: 'department' | 'cycle' | 'display_grade' | 'team'
  metricType?: 'count' | 'grade_distribution'
}

export type MasterFilters = {
  search?: string
  cycle?: string
  department?: string
  team?: string
  displayGrade?: string
  lineManagerGrade?: string
}

export type GradeBucket = {
  label: string
  count: number
  pct: number
}

export type DashboardSummary = {
  totalEmployees: number
  totalRecords: number
  recordsWithScorecard: number
  cycles: string[]
  departments: string[]
  gradeDistribution: GradeBucket[]
  byDepartment: { department: string; count: number }[]
  byCycle: { cycle: string; count: number }[]
  lastSyncedAt: string | null
}

export type EmployeeSummary = {
  employeeId: string
  employeeName: string
  department: string | null
  team: string | null
  lineManagerName: string | null
  cyclesCount: number
  latestCycle: string | null
  latestDisplayGrade: string | null
  latestLineManagerGrade: string | null
  records: PerformanceRecord[]
}

export type DepartmentSummary = {
  department: string
  employeeCount: number
  recordCount: number
  cyclesCount: number
  gradeDistribution: GradeBucket[]
  teams: { team: string; count: number }[]
}

export type CalibrationRow = {
  recordId: string
  employeeName: string | null
  cycleName: string | null
  department: string | null
  displayGrade: string | null
  lineManagerGrade: string | null
  calculatedGrade: string | null
  departmentCalibrator: string | null
  functionCalibrator: string | null
  gradeCalibrated: string | null
  calibrationFlags: string | null
}
