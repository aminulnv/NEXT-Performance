import {
  dayOfQuarter,
  formatQuarterYear,
  parseQuarterYearFromCycle,
  previousCalendarQuarter,
  quarterStartDate,
  type CalendarQuarter,
} from '@/lib/calendarQuarters'
import {
  buildLineManagerLookup,
  resolveLineManagerForOwner,
  type LineManagerInfo,
  type ManagerPendingApproval,
} from '@/lib/goalOwnerProfiles'
import type { GoalRecord } from '@/types/goals'
import type { GradeBucket, PerformanceRecord } from '@/types/performance'

export type { ManagerPendingApproval } from '@/lib/goalOwnerProfiles'

/** Revolut PTR target: Exceptional 5%, Exceeding 15%, Performing 60%, Developing 15%, Unsatisfactory 5% */
export const PTR_GRADE_TARGETS: Record<string, number> = {
  Exceptional: 5,
  Exceeding: 15,
  Performing: 60,
  Developing: 15,
  Unsatisfactory: 5,
}

const EMPLOYEE_KPI_UNIT = 'employee kpi'
const DRAFT_APPROVAL = 'draft'
const PENDING_APPROVAL = 'pending'
const APPROVED_APPROVAL = 'approved'

export type GoalAggregate = {
  goalId: string
  title: string | null
  owner: string
  ownerFullName: string | null
  reviewCycle: string | null
  organisationUnit: string | null
  organisationName: string | null
  approvalStatus: string | null
  goalStatus: string | null
  hasMetrics: boolean
  hasProgressUpdate: boolean
}

export type EmployeeGoalStatus = {
  owner: string
  ownerFullName: string | null
  employeeId: string | null
  reviewCycle: string | null
  employeeGoalCount: number
  submitted: boolean
  fullyApproved: boolean
  hasPendingApproval: boolean
  hasProgressUpdate: boolean
  goals: GoalAggregate[]
}

export type GoalsMonitoringSummary = {
  cycleFilter: string | null
  calendarQuarter: CalendarQuarter | null
  calendarYear: number | null
  quarterStartDate: string | null
  quarterDay: number | null
  totalOwners: number
  submissionRatePct: number
  approvalRatePct: number
  progressUpdateRatePct: number
  notSubmitted: EmployeeGoalStatus[]
  submittedNotApproved: EmployeeGoalStatus[]
  lowProgressUpdates: EmployeeGoalStatus[]
  flagDay15NotSubmitted: EmployeeGoalStatus[]
  flagDay30NotSubmitted: EmployeeGoalStatus[]
}

export type GradeComparisonRow = {
  label: string
  actualPct: number
  targetPct: number
  actualCount: number
  gap: number
}

const GRADE_COMPARE_ORDER = [
  'Exceptional',
  'Exceeding',
  'Performing',
  'Developing',
  'Unsatisfactory',
] as const

export function buildGradeComparison(
  distribution: GradeBucket[],
  targets: Record<string, number> = PTR_GRADE_TARGETS,
): GradeComparisonRow[] {
  const actualByLabel = new Map(distribution.map((d) => [d.label, d]))
  const labels = [
    ...GRADE_COMPARE_ORDER.filter((l) => l in targets),
    ...distribution
      .map((d) => d.label)
      .filter((l) => !GRADE_COMPARE_ORDER.includes(l as (typeof GRADE_COMPARE_ORDER)[number])),
  ]

  return labels.map((label) => {
    const actual = actualByLabel.get(label)
    const targetPct = targets[label] ?? 0
    const actualPct = actual?.pct ?? 0
    return {
      label,
      actualPct,
      targetPct: targets[label] != null ? targetPct : 0,
      actualCount: actual?.count ?? 0,
      gap: targets[label] != null ? actualPct - targetPct : actualPct,
    }
  })
}

export type CheckInOpenGoal = {
  goalId: string
  title: string | null
  goalStatus: string | null
}

export type CheckInOwnerRow = {
  owner: string
  ownerFullName: string | null
  priorReviewCycle: string
  openGoals: CheckInOpenGoal[]
}

export type CheckInMonitoringSummary = {
  monitoringQuarter: CalendarQuarter
  monitoringYear: number
  priorQuarterLabel: string
  monitoringQuarterLabel: string
  quarterDay: number | null
  pastDay15: boolean
  ownersWithPriorGoals: number
  completionRatePct: number
  needingCheckIn: CheckInOwnerRow[]
  overdueAfterDay15: CheckInOwnerRow[]
}

export type RatingMonitoringSummary = {
  cycleFilter: string | null
  totalRated: number
  distribution: GradeBucket[]
  targetDistribution: GradeBucket[]
  gradeComparison: GradeComparisonRow[]
  outlierDepartments: {
    department: string
    count: number
    distribution: GradeBucket[]
    maxSkewPct: number
  }[]
  devOrUnsatisfactory: {
    employeeId: string | null
    employeeName: string | null
    department: string | null
    cycleName: string | null
    displayGrade: string | null
  }[]
}

function field(goal: GoalRecord, ...keys: string[]): string | null {
  const fields = goal.fields
  if (!fields || typeof fields !== 'object') return null
  for (const key of keys) {
    const v = fields[key]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return null
}

export function goalOwner(goal: GoalRecord): string | null {
  return (
    goal.owner ??
    goal.employee_name ??
    field(goal, 'Owner', 'owner', 'Owner Full Name') ??
    null
  )
}

export function goalReviewCycle(goal: GoalRecord): string | null {
  return goal.review_cycle ?? goal.cycle_name ?? field(goal, 'Review cycle', 'Cycle Name') ?? null
}

function parseNum(value: string | null | undefined): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function metricHasProgressUpdate(goal: GoalRecord): boolean {
  const progress = parseNum(goal.progress ?? field(goal, 'Progress'))
  if (progress != null && progress > 0) return true
  const current = parseNum(goal.current_value ?? field(goal, 'Current Value'))
  const initial = parseNum(goal.initial_value ?? field(goal, 'Initial value'))
  if (current != null && initial != null && current !== initial) return true
  return false
}

/** One row per Goal ID (metrics rolled up). */
export function aggregateGoalsById(goals: GoalRecord[]): GoalAggregate[] {
  const byId = new Map<string, { goal: GoalRecord; hasMetrics: boolean; hasProgress: boolean }>()

  for (const g of goals) {
    const goalId = g.goal_id ?? field(g, 'Goal ID') ?? g.id
    const existing = byId.get(goalId)
    const hasMetric = Boolean(field(g, 'Metric ID', 'Metric name'))
    const hasProgress = metricHasProgressUpdate(g)

    if (!existing) {
      byId.set(goalId, { goal: g, hasMetrics: hasMetric, hasProgress })
    } else {
      existing.hasMetrics = existing.hasMetrics || hasMetric
      existing.hasProgress = existing.hasProgress || hasProgress
    }
  }

  return [...byId.values()].map(({ goal, hasMetrics, hasProgress }) => ({
    goalId: goal.goal_id ?? field(goal, 'Goal ID') ?? goal.id,
    title: goal.title ?? field(goal, 'Goal Name'),
    owner: goalOwner(goal) ?? '',
    ownerFullName: goal.owner_full_name ?? field(goal, 'Owner Full Name'),
    reviewCycle: goalReviewCycle(goal),
    organisationUnit: goal.organisation_unit ?? field(goal, 'Organisation Unit'),
    organisationName: goal.organisation_name ?? field(goal, 'Organisation Name'),
    approvalStatus: (goal.approval_status ?? field(goal, 'Approval Status'))?.toLowerCase() ?? null,
    goalStatus: goal.status ?? field(goal, 'Goal Status'),
    hasMetrics,
    hasProgressUpdate: hasProgress,
  }))
}

function isEmployeeKpi(goal: GoalAggregate): boolean {
  return (goal.organisationUnit ?? '').trim().toLowerCase() === EMPLOYEE_KPI_UNIT
}

function isSubmittedGoal(goal: GoalAggregate): boolean {
  if (!isEmployeeKpi(goal)) return false
  const title = (goal.title ?? '').trim()
  if (!title) return false
  if (goal.approvalStatus === DRAFT_APPROVAL) return false
  return true
}

function isGoalMarkedComplete(status: string | null): boolean {
  const normalized = (status ?? '').trim().toLowerCase()
  return normalized === 'complete' || normalized === 'completed'
}

function goalMatchesPriorQuarter(
  goal: GoalAggregate,
  priorQuarter: CalendarQuarter,
  priorYear: number,
): boolean {
  if (!isEmployeeKpi(goal)) return false
  const parsed = parseQuarterYearFromCycle(goal.reviewCycle)
  if (!parsed) return false
  return parsed.quarter === priorQuarter && parsed.year === priorYear
}

/** Prior-quarter employee goals must be marked complete by Day 15 of the monitoring quarter. */
export function buildCheckInCompletionSummary(
  goals: GoalRecord[],
  options: {
    monitoringQuarter: CalendarQuarter
    monitoringYear: number
    referenceDate?: Date
  },
): CheckInMonitoringSummary {
  const prior = previousCalendarQuarter(options.monitoringQuarter, options.monitoringYear)
  const priorQuarterLabel = formatQuarterYear(prior.quarter, prior.year)
  const monitoringQuarterLabel = formatQuarterYear(
    options.monitoringQuarter,
    options.monitoringYear,
  )
  const quarterDay = dayOfQuarter(
    options.monitoringYear,
    options.monitoringQuarter,
    options.referenceDate ?? new Date(),
  )
  const pastDay15 = quarterDay != null && quarterDay > 15

  const priorGoals = aggregateGoalsById(goals).filter((g) =>
    goalMatchesPriorQuarter(g, prior.quarter, prior.year),
  )

  const byOwner = new Map<string, GoalAggregate[]>()
  for (const goal of priorGoals) {
    if (!goal.owner) continue
    const list = byOwner.get(goal.owner) ?? []
    list.push(goal)
    byOwner.set(goal.owner, list)
  }

  const needingCheckIn: CheckInOwnerRow[] = []
  let ownersComplete = 0

  for (const [owner, ownerGoals] of byOwner) {
    const openGoals = ownerGoals.filter((g) => !isGoalMarkedComplete(g.goalStatus))
    if (openGoals.length === 0) {
      ownersComplete++
      continue
    }
    needingCheckIn.push({
      owner,
      ownerFullName: ownerGoals[0]?.ownerFullName ?? null,
      priorReviewCycle: priorQuarterLabel,
      openGoals: openGoals.map((g) => ({
        goalId: g.goalId,
        title: g.title,
        goalStatus: g.goalStatus,
      })),
    })
  }

  needingCheckIn.sort((a, b) =>
    (a.ownerFullName ?? a.owner).localeCompare(b.ownerFullName ?? b.owner),
  )

  const ownersWithPriorGoals = byOwner.size
  const total = ownersWithPriorGoals || 1

  return {
    monitoringQuarter: options.monitoringQuarter,
    monitoringYear: options.monitoringYear,
    priorQuarterLabel,
    monitoringQuarterLabel,
    quarterDay,
    pastDay15,
    ownersWithPriorGoals,
    completionRatePct: Math.round((ownersComplete / total) * 100),
    needingCheckIn,
    overdueAfterDay15: pastDay15 ? needingCheckIn : [],
  }
}

function matchesCycle(goal: GoalAggregate, cycleFilter: string | null): boolean {
  if (!cycleFilter) return true
  const cycle = (goal.reviewCycle ?? '').trim()
  if (!cycle) return false
  return cycle.toLowerCase() === cycleFilter.trim().toLowerCase()
}

export function uniqueReviewCycles(goals: GoalRecord[]): string[] {
  const cycles = new Set<string>()
  for (const g of goals) {
    const c = goalReviewCycle(g)
    if (c) cycles.add(c)
  }
  return [...cycles].sort()
}

const UNKNOWN_LINE_MANAGER: LineManagerInfo = {
  key: '__unknown_line_manager__',
  id: null,
  name: 'Unknown line manager',
  email: null,
}

export function buildManagersPendingApproval(
  goals: GoalRecord[],
  records: PerformanceRecord[],
  cycleFilter: string | null = null,
): ManagerPendingApproval[] {
  const lineManagers = buildLineManagerLookup(records, cycleFilter)
  const aggregates = aggregateGoalsById(goals).filter((g) => matchesCycle(g, cycleFilter))
  const employeeIdByOwner = new Map<string, string | null>()

  for (const g of goals) {
    const owner = goalOwner(g)
    if (!owner || !g.employee_id || employeeIdByOwner.has(owner)) continue
    const unit = (g.organisation_unit ?? field(g, 'Organisation Unit') ?? '')
      .trim()
      .toLowerCase()
    if (unit !== EMPLOYEE_KPI_UNIT) continue
    if (cycleFilter) {
      const cycle = goalReviewCycle(g)
      if (!cycle || cycle.toLowerCase() !== cycleFilter.trim().toLowerCase()) continue
    }
    employeeIdByOwner.set(owner, g.employee_id)
  }

  const counts = new Map<string, { manager: LineManagerInfo; pendingGoalCount: number }>()

  for (const goal of aggregates) {
    if (!isEmployeeKpi(goal) || !isSubmittedGoal(goal)) continue
    if (goal.approvalStatus !== PENDING_APPROVAL) continue

    const manager =
      resolveLineManagerForOwner(
        goal.owner,
        employeeIdByOwner.get(goal.owner) ?? null,
        lineManagers,
      ) ?? UNKNOWN_LINE_MANAGER

    const existing = counts.get(manager.key)
    if (existing) {
      existing.pendingGoalCount += 1
    } else {
      counts.set(manager.key, { manager, pendingGoalCount: 1 })
    }
  }

  return [...counts.values()].sort((a, b) => {
    if (b.pendingGoalCount !== a.pendingGoalCount) {
      return b.pendingGoalCount - a.pendingGoalCount
    }
    return a.manager.name.localeCompare(b.manager.name)
  })
}

export function buildEmployeeGoalStatuses(
  goals: GoalRecord[],
  cycleFilter: string | null = null,
): EmployeeGoalStatus[] {
  const aggregates = aggregateGoalsById(goals).filter((g) => matchesCycle(g, cycleFilter))
  const employeeGoals = aggregates.filter(isEmployeeKpi)
  const byOwner = new Map<string, GoalAggregate[]>()

  for (const g of employeeGoals) {
    if (!g.owner) continue
    const list = byOwner.get(g.owner) ?? []
    list.push(g)
    byOwner.set(g.owner, list)
  }

  const employeeIdByOwner = new Map<string, string | null>()
  for (const g of goals) {
    const owner = goalOwner(g)
    if (!owner || !g.employee_id || employeeIdByOwner.has(owner)) continue
    const unit = (g.organisation_unit ?? field(g, 'Organisation Unit') ?? '')
      .trim()
      .toLowerCase()
    if (unit !== EMPLOYEE_KPI_UNIT) continue
    if (cycleFilter) {
      const cycle = goalReviewCycle(g)
      if (!cycle || cycle.toLowerCase() !== cycleFilter.trim().toLowerCase()) continue
    }
    employeeIdByOwner.set(owner, g.employee_id)
  }

  return [...byOwner.entries()].map(([owner, ownerGoals]) => {
    const submittedGoals = ownerGoals.filter(isSubmittedGoal)
    const submitted = submittedGoals.length > 0
    const pending = submittedGoals.some((g) => g.approvalStatus === PENDING_APPROVAL)
    const approved =
      submitted &&
      submittedGoals.every((g) => g.approvalStatus === APPROVED_APPROVAL)
    const hasProgressUpdate = submittedGoals.some((g) => g.hasProgressUpdate)

    return {
      owner,
      ownerFullName: ownerGoals[0]?.ownerFullName ?? null,
      employeeId: employeeIdByOwner.get(owner) ?? null,
      reviewCycle: cycleFilter ?? ownerGoals[0]?.reviewCycle ?? null,
      employeeGoalCount: ownerGoals.length,
      submitted,
      fullyApproved: approved,
      hasPendingApproval: pending,
      hasProgressUpdate,
      goals: ownerGoals,
    }
  })
}

export function buildGoalsMonitoringSummary(
  goals: GoalRecord[],
  options: {
    cycleFilter?: string | null
    calendarQuarter?: CalendarQuarter | null
    calendarYear?: number | null
    referenceDate?: Date
  } = {},
): GoalsMonitoringSummary {
  const cycleFilter = options.cycleFilter ?? null
  const employees = buildEmployeeGoalStatuses(goals, cycleFilter)
  const total = employees.length || 1

  const submitted = employees.filter((e) => e.submitted)
  const fullyApproved = employees.filter((e) => e.submitted && e.fullyApproved)
  const withProgress = employees.filter((e) => e.submitted && e.hasProgressUpdate)

  const notSubmitted = employees.filter((e) => !e.submitted)
  const submittedNotApproved = employees.filter(
    (e) => e.submitted && !e.fullyApproved,
  )
  const lowProgressUpdates = employees.filter(
    (e) => e.submitted && !e.hasProgressUpdate,
  )

  const calendarQuarter = options.calendarQuarter ?? null
  const calendarYear = options.calendarYear ?? null
  const ref = options.referenceDate ?? new Date()

  let quarterStart: string | null = null
  let quarterDay: number | null = null
  let flagDay15: EmployeeGoalStatus[] = []
  let flagDay30: EmployeeGoalStatus[] = []

  if (calendarQuarter != null && calendarYear != null) {
    quarterStart = quarterStartDate(calendarYear, calendarQuarter)
    quarterDay = dayOfQuarter(calendarYear, calendarQuarter, ref)
    if (quarterDay != null && quarterDay >= 15) flagDay15 = notSubmitted
    if (quarterDay != null && quarterDay >= 30) flagDay30 = notSubmitted
  }

  return {
    cycleFilter,
    calendarQuarter,
    calendarYear,
    quarterStartDate: quarterStart,
    quarterDay,
    totalOwners: employees.length,
    submissionRatePct: Math.round((submitted.length / total) * 100),
    approvalRatePct: Math.round((fullyApproved.length / total) * 100),
    progressUpdateRatePct: Math.round((withProgress.length / total) * 100),
    notSubmitted,
    submittedNotApproved,
    lowProgressUpdates,
    flagDay15NotSubmitted: flagDay15,
    flagDay30NotSubmitted: flagDay30,
  }
}

function gradeBuckets(counts: Map<string, number>): GradeBucket[] {
  const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({
      label,
      count,
      pct: Math.round((count / total) * 100),
    }))
}

export function buildRatingMonitoringSummary(
  records: PerformanceRecord[],
  cycleFilter: string | null = null,
): RatingMonitoringSummary {
  const filtered = cycleFilter
    ? records.filter((r) => r.cycle_name === cycleFilter)
    : records

  const rated = filtered.filter((r) => r.display_grade)
  const gradeCounts = new Map<string, number>()
  for (const r of rated) {
    const g = r.display_grade ?? 'Unknown'
    gradeCounts.set(g, (gradeCounts.get(g) ?? 0) + 1)
  }

  const distribution = gradeBuckets(gradeCounts)
  const targetDistribution = Object.entries(PTR_GRADE_TARGETS).map(([label, pct]) => ({
    label,
    count: 0,
    pct,
  }))

  const deptMap = new Map<string, PerformanceRecord[]>()
  for (const r of rated) {
    const dept = r.department ?? 'Unknown'
    const list = deptMap.get(dept) ?? []
    list.push(r)
    deptMap.set(dept, list)
  }

  const outlierDepartments = [...deptMap.entries()]
    .map(([department, deptRecords]) => {
      const counts = new Map<string, number>()
      for (const r of deptRecords) {
        const g = r.display_grade ?? 'Unknown'
        counts.set(g, (counts.get(g) ?? 0) + 1)
      }
      const dist = gradeBuckets(counts)
      let maxSkewPct = 0
      for (const bucket of dist) {
        const target = PTR_GRADE_TARGETS[bucket.label] ?? null
        if (target != null) {
          maxSkewPct = Math.max(maxSkewPct, Math.abs(bucket.pct - target))
        } else if (bucket.pct >= 80) {
          maxSkewPct = Math.max(maxSkewPct, bucket.pct)
        }
      }
      return { department, count: deptRecords.length, distribution: dist, maxSkewPct }
    })
    .filter((d) => d.count >= 3 && d.maxSkewPct >= 40)
    .sort((a, b) => b.maxSkewPct - a.maxSkewPct)

  const devOrUnsatisfactory = rated
    .filter((r) => {
      const g = (r.display_grade ?? '').toLowerCase()
      return g === 'developing' || g === 'unsatisfactory'
    })
    .map((r) => ({
      employeeId: r.employee_id,
      employeeName: r.employee_name,
      department: r.department,
      cycleName: r.cycle_name,
      displayGrade: r.display_grade,
    }))

  const gradeComparison = buildGradeComparison(distribution).filter(
    (row) => PTR_GRADE_TARGETS[row.label] != null,
  )

  return {
    cycleFilter,
    totalRated: rated.length,
    distribution,
    targetDistribution,
    gradeComparison,
    outlierDepartments,
    devOrUnsatisfactory,
  }
}
