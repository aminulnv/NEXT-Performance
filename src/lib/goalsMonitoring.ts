import { filterActiveEmployees, filterEmployeesForQuarter } from '@/lib/activeEmployees'
import {
  dayOfQuarter,
  formatQuarterYear,
  parseQuarterYearFromCycle,
  previousCalendarQuarter,
  quarterStartDate,
  resolveMonitoringQuarter,
  reviewCyclesMatch,
  type CalendarQuarter,
} from '@/lib/calendarQuarters'
import {
  buildLineManagerLookup,
  extractLocationLabel,
  normalizeEmployeeLocation,
  resolveLineManagerForOwner,
  resolveProfileAvatar,
  type GoalOwnerProfileLookup,
  type LineManagerInfo,
  type ManagerPendingApproval,
} from '@/lib/goalOwnerProfiles'
import type { EmployeeDirectoryEntry } from '@/types/employee'
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
  employeeId: string | null
  employeeName: string | null
  reviewCycle: string | null
  organisationUnit: string | null
  organisationName: string | null
  approvalStatus: string | null
  goalStatus: string | null
  hasMetrics: boolean
  hasProgressUpdate: boolean
  submittedAt: string | null
  approvedAt: string | null
}

export type EmployeeGoalStatus = {
  owner: string
  ownerFullName: string | null
  employeeId: string | null
  department: string | null
  team: string | null
  location: string | null
  lineManagerKey: string
  lineManagerName: string
  lineManagerId: string | null
  lineManagerEmail: string | null
  reviewCycle: string | null
  employeeGoalCount: number
  submittedGoalCount: number
  submitted: boolean
  fullyApproved: boolean
  hasPendingApproval: boolean
  hasProgressUpdate: boolean
  goals: GoalAggregate[]
  /** Present in goals export but not matched to the active People directory roster. */
  exportOnly?: boolean
}

export type GoalSubmissionCounts = {
  submitted: { count: number; goalCount: number; pct: number }
  pendingSubmission: { count: number; pct: number }
  awaitingApproval: { count: number; pct: number }
  approvedLocked: { count: number; pct: number }
  overdueDay30NotApproved: { count: number; pct: number }
}

export type ManagerTeamSummary = {
  manager: LineManagerInfo
  teamSize: number
  submittedCount: number
  fullyApprovedCount: number
  pendingApprovalGoalCount: number
  oldestPendingDays: number | null
  allTeamApproved: boolean
  zeroTeamSubmitted: boolean
}

export type ManagerComplianceMetrics = {
  managersInScope: number
  managersWithSubmittedTeam: number
  managersAllTeamApprovedPct: number
  managersAllTeamApprovedCount: number
  avgDaysSubmissionToApproval: number | null
  managersZeroTeamSubmitted: ManagerTeamSummary[]
  managersPendingOver5Days: ManagerTeamSummary[]
}

export type GoalBreakdownRow = {
  key: string
  label: string
  avatarUrl?: string | null
  totalEmployees: number
  submittedCount: number
  submittedPct: number
  pendingSubmissionCount: number
  awaitingApprovalCount: number
  approvedCount: number
}

export type LowSubmissionDepartment = {
  department: string
  totalEmployees: number
  submissionPct: number
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
  submissionCounts: GoalSubmissionCounts
  submitted: EmployeeGoalStatus[]
  notSubmitted: EmployeeGoalStatus[]
  awaitingApproval: EmployeeGoalStatus[]
  approvedLocked: EmployeeGoalStatus[]
  submittedNotApproved: EmployeeGoalStatus[]
  lowProgressUpdates: EmployeeGoalStatus[]
  flagDay10NotSubmitted: EmployeeGoalStatus[]
  flagDay15NotSubmitted: EmployeeGoalStatus[]
  flagDay30NotSubmitted: EmployeeGoalStatus[]
  overdueDay30NotApproved: EmployeeGoalStatus[]
  managerCompliance: ManagerComplianceMetrics
  breakdownByDepartment: GoalBreakdownRow[]
  breakdownByTeam: GoalBreakdownRow[]
  breakdownByLocation: GoalBreakdownRow[]
  breakdownByManager: GoalBreakdownRow[]
  qualityWrongGoalCount: EmployeeGoalStatus[]
  lowSubmissionDepartments: LowSubmissionDepartment[]
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
  const normalizedFields = new Map(
    Object.entries(fields).map(([key, value]) => [key.trim().toLowerCase(), value]),
  )
  for (const key of keys) {
    const value = normalizedFields.get(key.trim().toLowerCase())
    if (value != null && String(value).trim() !== '') return String(value).trim()
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

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function goalReviewCycle(goal: GoalRecord): string | null {
  return (
    nonEmpty(goal.review_cycle) ??
    nonEmpty(goal.cycle_name) ??
    field(goal, 'Review Cycle', 'Review cycle', 'Cycle Name', 'Cycle') ??
    null
  )
}

export function goalMatchesReviewCycle(
  goal: GoalRecord,
  cycleFilter: string | null | undefined,
): boolean {
  return reviewCyclesMatch(cycleFilter, goalReviewCycle(goal))
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

function goalSubmittedAt(goal: GoalRecord): string | null {
  return (
    goal.submitted_at ??
    field(goal, 'Submitted Date', 'Submission Date', 'Submitted At', 'Date Submitted') ??
    null
  )
}

function goalApprovedAt(goal: GoalRecord): string | null {
  return (
    goal.approved_at ??
    field(goal, 'Approval Date', 'Approved Date', 'Approved At', 'Last Approved Date') ??
    null
  )
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null
  const d = new Date(value.trim())
  return Number.isNaN(d.getTime()) ? null : d
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

function mergeGoalRecord(base: GoalRecord, incoming: GoalRecord): GoalRecord {
  const mergedFields: Record<string, string> = { ...(base.fields ?? {}), ...(incoming.fields ?? {}) }
  for (const record of [base, incoming]) {
    for (const [key, value] of Object.entries(record.fields ?? {})) {
      const trimmed = value?.trim()
      if (trimmed && !mergedFields[key]?.trim()) mergedFields[key] = trimmed
    }
  }

  return {
    ...base,
    employee_id: nonEmpty(base.employee_id) ?? nonEmpty(incoming.employee_id),
    employee_name: nonEmpty(base.employee_name) ?? nonEmpty(incoming.employee_name),
    owner: nonEmpty(base.owner) ?? nonEmpty(incoming.owner),
    owner_full_name: nonEmpty(base.owner_full_name) ?? nonEmpty(incoming.owner_full_name),
    cycle_name: nonEmpty(base.cycle_name) ?? nonEmpty(incoming.cycle_name),
    review_cycle: nonEmpty(base.review_cycle) ?? nonEmpty(incoming.review_cycle),
    title: nonEmpty(base.title) ?? nonEmpty(incoming.title),
    status: nonEmpty(base.status) ?? nonEmpty(incoming.status),
    progress: nonEmpty(base.progress) ?? nonEmpty(incoming.progress),
    approval_status: nonEmpty(base.approval_status) ?? nonEmpty(incoming.approval_status),
    organisation_unit: nonEmpty(base.organisation_unit) ?? nonEmpty(incoming.organisation_unit),
    organisation_name: nonEmpty(base.organisation_name) ?? nonEmpty(incoming.organisation_name),
    current_value: nonEmpty(base.current_value) ?? nonEmpty(incoming.current_value),
    initial_value: nonEmpty(base.initial_value) ?? nonEmpty(incoming.initial_value),
    submitted_at: nonEmpty(base.submitted_at) ?? nonEmpty(incoming.submitted_at),
    approved_at: nonEmpty(base.approved_at) ?? nonEmpty(incoming.approved_at),
    fields: mergedFields,
  }
}

function normalizePersonName(name: string | null | undefined): string | null {
  const trimmed = name?.trim().toLowerCase().replace(/\s+/g, ' ')
  return trimmed || null
}

function namesLikelyMatch(left: string, right: string): boolean {
  if (left === right) return true
  const shorter = left.length <= right.length ? left : right
  const longer = left.length <= right.length ? right : left
  if (shorter.length < 4) return false
  return longer.includes(shorter)
}

function addOwnerGoals(
  byOwner: Map<string, GoalAggregate[]>,
  ownerKey: string | null | undefined,
  goal: GoalAggregate,
) {
  if (!ownerKey) return
  const list = byOwner.get(ownerKey) ?? []
  list.push(goal)
  byOwner.set(ownerKey, list)
}

function lookupGoalsForEmployee(
  maps: {
    byOwner: Map<string, GoalAggregate[]>
    byEmployeeId: Map<string, GoalAggregate[]>
    employeeGoals: GoalAggregate[]
  },
  employee: EmployeeDirectoryEntry,
): GoalAggregate[] {
  const matches: GoalAggregate[] = []
  const ids = new Set<string>()
  if (employee.id) ids.add(employee.id)
  if (employee.remoteId) ids.add(employee.remoteId)

  for (const id of ids) {
    const goals = maps.byEmployeeId.get(id)
    if (goals) matches.push(...goals)
    const fromOwner = maps.byOwner.get(id.trim().toLowerCase())
    if (fromOwner) matches.push(...fromOwner)
  }

  if (employee.email) {
    const goals = maps.byOwner.get(employee.email.trim().toLowerCase())
    if (goals) matches.push(...goals)
  }

  const nameKey = normalizePersonName(employee.name)
  if (nameKey) {
    const exact = maps.byOwner.get(nameKey)
    if (exact) matches.push(...exact)
    for (const [key, goals] of maps.byOwner) {
      if (key === nameKey) continue
      if (namesLikelyMatch(nameKey, key)) matches.push(...goals)
    }
  }

  for (const goal of maps.employeeGoals) {
    if (goal.employeeId && ids.has(goal.employeeId)) {
      matches.push(goal)
      continue
    }
    if (employee.email && goal.owner.trim().toLowerCase() === employee.email.trim().toLowerCase()) {
      matches.push(goal)
      continue
    }
    const goalName = normalizePersonName(goal.employeeName ?? goal.ownerFullName)
    if (nameKey && goalName && namesLikelyMatch(nameKey, goalName)) {
      matches.push(goal)
    }
  }

  return dedupeGoalAggregates(matches)
}

function pct(count: number, total: number): number {
  return Math.round((count / (total || 1)) * 100)
}

function countBucket(count: number, total: number) {
  return { count, pct: pct(count, total) }
}

function goalEmployeeId(goal: GoalRecord): string | null {
  return nonEmpty(goal.employee_id) ?? field(goal, 'Employee ID', 'Reviewed Employee ID')
}

function goalEmployeeName(goal: GoalRecord): string | null {
  return (
    nonEmpty(goal.employee_name) ??
    field(goal, 'Employee', 'Employee Name', 'Reviewed Employee', 'Owner Full Name')
  )
}

/** Roll up metric rows that share a Goal ID, or the same owner + title + cycle. */
function goalAggregateKey(goal: GoalRecord): string {
  const explicit = nonEmpty(goal.goal_id) ?? field(goal, 'Goal ID')
  if (explicit) return explicit

  const owner = goalOwner(goal)?.trim().toLowerCase()
  const title = (goal.title ?? field(goal, 'Goal Name', 'Goal Title', 'Goal'))?.trim().toLowerCase()
  const cycle = goalReviewCycle(goal)?.trim().toLowerCase()
  if (owner && title) return `${owner}|${title}|${cycle ?? ''}`

  return goal.id
}

function ownerLookupKeys(goal: GoalAggregate): string[] {
  const keys = new Set<string>()
  const owner = goal.owner.trim().toLowerCase()
  if (owner) keys.add(owner)

  const fullName = normalizePersonName(goal.ownerFullName)
  if (fullName) keys.add(fullName)

  const employeeName = normalizePersonName(goal.employeeName)
  if (employeeName) keys.add(employeeName)

  const employeeId = goal.employeeId?.trim().toLowerCase()
  if (employeeId) keys.add(employeeId)

  return [...keys]
}

/** One row per Goal ID (metrics rolled up). */
export function aggregateGoalsById(goals: GoalRecord[]): GoalAggregate[] {
  const byId = new Map<
    string,
    {
      goal: GoalRecord
      hasMetrics: boolean
      hasProgress: boolean
      submittedAt: string | null
      approvedAt: string | null
    }
  >()

  for (const g of goals) {
    const goalId = goalAggregateKey(g)
    const existing = byId.get(goalId)
    const hasMetric = Boolean(field(g, 'Metric ID', 'Metric name'))
    const hasProgress = metricHasProgressUpdate(g)
    const submittedAt = goalSubmittedAt(g)
    const approvedAt = goalApprovedAt(g)

    if (!existing) {
      byId.set(goalId, { goal: g, hasMetrics: hasMetric, hasProgress, submittedAt, approvedAt })
    } else {
      existing.goal = mergeGoalRecord(existing.goal, g)
      existing.hasMetrics = existing.hasMetrics || hasMetric
      existing.hasProgress = existing.hasProgress || hasProgress
      if (submittedAt && (!existing.submittedAt || submittedAt < existing.submittedAt)) {
        existing.submittedAt = submittedAt
      }
      if (approvedAt && (!existing.approvedAt || approvedAt > existing.approvedAt)) {
        existing.approvedAt = approvedAt
      }
    }
  }

  return [...byId.values()].map(({ goal, hasMetrics, hasProgress, submittedAt, approvedAt }) => ({
    goalId: goalAggregateKey(goal),
    title: goal.title ?? field(goal, 'Goal Name', 'Goal Title', 'Goal'),
    owner: goalOwner(goal) ?? '',
    ownerFullName: goal.owner_full_name ?? field(goal, 'Owner Full Name'),
    employeeId: goalEmployeeId(goal),
    employeeName: goalEmployeeName(goal),
    reviewCycle: goalReviewCycle(goal),
    organisationUnit:
      goal.organisation_unit ??
      field(goal, 'Organisation Unit', 'Organization Unit', 'Org Unit'),
    organisationName:
      goal.organisation_name ?? field(goal, 'Organisation Name', 'Organization Name'),
    approvalStatus: (goal.approval_status ?? field(goal, 'Approval Status'))?.toLowerCase() ?? null,
    goalStatus: goal.status ?? field(goal, 'Goal Status', 'Status'),
    hasMetrics,
    hasProgressUpdate: hasProgress,
    submittedAt,
    approvedAt,
  }))
}

function isEmployeeKpi(goal: GoalAggregate): boolean {
  const unit = (goal.organisationUnit ?? '').trim().toLowerCase()
  if (unit === EMPLOYEE_KPI_UNIT || (unit.includes('employee') && unit.includes('kpi'))) {
    return true
  }
  if (
    unit &&
    (unit.includes('company') ||
      unit.includes('team goal') ||
      unit.includes('department goal') ||
      unit.includes('organisation goal') ||
      unit.includes('organization goal'))
  ) {
    return false
  }
  return Boolean((goal.title ?? '').trim() && (goal.employeeId || goal.employeeName || goal.owner))
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
  return reviewCyclesMatch(cycleFilter, goal.reviewCycle)
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
    if (cycleFilter && !goalMatchesReviewCycle(g, cycleFilter)) continue
    const owner = goalOwner(g)
    const employeeId = goalEmployeeId(g)
    if (!owner || !employeeId || employeeIdByOwner.has(owner)) continue
    employeeIdByOwner.set(owner, employeeId)
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

function dedupeGoalAggregates(goals: GoalAggregate[]): GoalAggregate[] {
  const byId = new Map<string, GoalAggregate>()
  for (const goal of goals) {
    if (!byId.has(goal.goalId)) byId.set(goal.goalId, goal)
  }
  return [...byId.values()]
}

function lineManagerKeyFromDirectory(employee: EmployeeDirectoryEntry): string {
  return (
    employee.lineManagerEmail?.trim().toLowerCase() ??
    employee.lineManagerId ??
    UNKNOWN_LINE_MANAGER.key
  )
}

function employeeGoalStatusFromGoals(
  owner: string,
  ownerGoals: GoalAggregate[],
  context: {
    employeeId: string | null
    ownerFullName: string | null
    department: string | null
    team: string | null
    location: string | null
    lineManagerKey: string
    lineManagerName: string
    lineManagerId: string | null
    lineManagerEmail: string | null
    reviewCycle: string | null
    exportOnly?: boolean
  },
): EmployeeGoalStatus {
  const submittedGoals = ownerGoals.filter(isSubmittedGoal)
  const submitted = submittedGoals.length > 0
  const pending = submittedGoals.some((g) => g.approvalStatus === PENDING_APPROVAL)
  const approved =
    submitted && submittedGoals.every((g) => g.approvalStatus === APPROVED_APPROVAL)
  const hasProgressUpdate = submittedGoals.some((g) => g.hasProgressUpdate)

  return {
    owner,
    ownerFullName: context.ownerFullName,
    employeeId: context.employeeId,
    department: context.department,
    team: context.team,
    location: context.location,
    lineManagerKey: context.lineManagerKey,
    lineManagerName: context.lineManagerName,
    lineManagerId: context.lineManagerId,
    lineManagerEmail: context.lineManagerEmail,
    reviewCycle: context.reviewCycle,
    employeeGoalCount: ownerGoals.length,
    submittedGoalCount: submittedGoals.length,
    submitted,
    fullyApproved: approved,
    hasPendingApproval: pending,
    hasProgressUpdate,
    goals: ownerGoals,
    exportOnly: context.exportOnly,
  }
}

function buildGoalAggregateMaps(goals: GoalRecord[], cycleFilter: string | null) {
  const aggregates = aggregateGoalsById(goals).filter((g) => matchesCycle(g, cycleFilter))
  const employeeGoals = aggregates.filter(isEmployeeKpi)
  const byOwner = new Map<string, GoalAggregate[]>()
  const byEmployeeId = new Map<string, GoalAggregate[]>()

  for (const goal of employeeGoals) {
    for (const key of ownerLookupKeys(goal)) {
      addOwnerGoals(byOwner, key, goal)
    }
    if (goal.employeeId) {
      const list = byEmployeeId.get(goal.employeeId) ?? []
      list.push(goal)
      byEmployeeId.set(goal.employeeId, list)
    }
  }

  const employeeIdByOwner = new Map<string, string>()
  for (const goal of goals) {
    if (cycleFilter && !goalMatchesReviewCycle(goal, cycleFilter)) continue
    const employeeId = goalEmployeeId(goal)
    const owner = goalOwner(goal)?.trim().toLowerCase()

    if (employeeId) {
      const keys = new Set<string>()
      if (owner) keys.add(owner)
      const employeeName = normalizePersonName(goalEmployeeName(goal))
      if (employeeName) keys.add(employeeName)

      for (const key of keys) {
        employeeIdByOwner.set(key, employeeId)
      }
      employeeIdByOwner.set(employeeId.trim().toLowerCase(), employeeId)
    } else if (owner?.includes('@')) {
      employeeIdByOwner.set(owner, owner)
    }
  }

  for (const [ownerKey, ownerGoals] of byOwner) {
    const employeeId = employeeIdByOwner.get(ownerKey)
    if (!employeeId) continue
    const existing = byEmployeeId.get(employeeId) ?? []
    byEmployeeId.set(employeeId, dedupeGoalAggregates([...existing, ...ownerGoals]))
  }

  return { byOwner, byEmployeeId, employeeIdByOwner, employeeGoals }
}

function exportOnlyGoalStatuses(
  rosterStatuses: EmployeeGoalStatus[],
  maps: {
    byOwner: Map<string, GoalAggregate[]>
    byEmployeeId: Map<string, GoalAggregate[]>
    employeeIdByOwner: Map<string, string>
    employeeGoals: GoalAggregate[]
  },
  reviewCycle: string | null,
): EmployeeGoalStatus[] {
  const linkedGoalIds = new Set<string>()
  for (const status of rosterStatuses) {
    for (const goal of status.goals) linkedGoalIds.add(goal.goalId)
  }

  const groups = new Map<string, GoalAggregate[]>()
  for (const goal of maps.employeeGoals) {
    if (linkedGoalIds.has(goal.goalId)) continue
    const groupKey =
      goal.employeeId?.trim().toLowerCase() ??
      normalizePersonName(goal.employeeName) ??
      normalizePersonName(goal.ownerFullName) ??
      goal.owner.trim().toLowerCase()
    if (!groupKey) continue
    const list = groups.get(groupKey) ?? []
    list.push(goal)
    groups.set(groupKey, list)
  }

  return [...groups.entries()].map(([groupKey, ownerGoals]) => {
    const deduped = dedupeGoalAggregates(ownerGoals)
    return employeeGoalStatusFromGoals(groupKey, deduped, {
      employeeId: deduped[0]?.employeeId ?? maps.employeeIdByOwner.get(groupKey) ?? null,
      ownerFullName:
        deduped[0]?.employeeName ?? deduped[0]?.ownerFullName ?? deduped[0]?.owner ?? null,
      department: deduped[0]?.organisationName ?? null,
      team: null,
      location: null,
      lineManagerKey: UNKNOWN_LINE_MANAGER.key,
      lineManagerName: UNKNOWN_LINE_MANAGER.name,
      lineManagerId: null,
      lineManagerEmail: null,
      reviewCycle: reviewCycle ?? deduped[0]?.reviewCycle ?? null,
      exportOnly: true,
    })
  })
}

/** One row per active employee (People directory) or, without roster, per goals export owner. */
export function buildEmployeeGoalStatuses(
  goals: GoalRecord[],
  cycleFilter: string | null = null,
  activeRoster: EmployeeDirectoryEntry[] | null = null,
  options: {
    locationByEmployeeId?: Map<string, string | null>
    calendarQuarter?: CalendarQuarter | null
    calendarYear?: number | null
  } = {},
): EmployeeGoalStatus[] {
  const maps = buildGoalAggregateMaps(goals, cycleFilter)
  const reviewCycle = cycleFilter ?? null

  if (activeRoster?.length) {
    const monitoringQuarter = resolveMonitoringQuarter(
      cycleFilter,
      options.calendarQuarter ?? null,
      options.calendarYear ?? null,
    )
    const active = monitoringQuarter
      ? filterEmployeesForQuarter(
          activeRoster,
          monitoringQuarter.year,
          monitoringQuarter.quarter,
        )
      : filterActiveEmployees(activeRoster)
    const rosterStatuses = active.map((employee) => {
        const ownerKey = employee.email?.trim().toLowerCase() || employee.id
        const ownerGoals = lookupGoalsForEmployee(maps, employee)
        const locationFromPerf =
          options.locationByEmployeeId?.get(employee.id) ??
          (employee.email
            ? (options.locationByEmployeeId?.get(employee.email.trim().toLowerCase()) ?? null)
            : null)
        const location =
          extractLocationLabel(locationFromPerf) ??
          extractLocationLabel(employee.location) ??
          extractLocationLabel(employee.profile?.location) ??
          null

        return employeeGoalStatusFromGoals(ownerKey, ownerGoals, {
          employeeId: employee.id,
          ownerFullName: employee.name,
          department: employee.department,
          team: employee.team?.trim() || null,
          location,
          lineManagerKey: lineManagerKeyFromDirectory(employee),
          lineManagerName: employee.lineManagerName?.trim() || UNKNOWN_LINE_MANAGER.name,
          lineManagerId: employee.lineManagerId,
          lineManagerEmail: employee.lineManagerEmail,
          reviewCycle,
        })
      })

    const exportOnly = exportOnlyGoalStatuses(rosterStatuses, maps, reviewCycle)

    return [...rosterStatuses, ...exportOnly].sort((a, b) =>
        (a.ownerFullName ?? a.owner).localeCompare(b.ownerFullName ?? b.owner),
      )
  }

  const statuses = new Map<string, EmployeeGoalStatus>()
  for (const [ownerKey, ownerGoals] of maps.byOwner) {
    const employeeId =
      maps.employeeIdByOwner.get(ownerKey) ?? ownerGoals[0]?.employeeId ?? ownerKey
    if (statuses.has(employeeId)) continue
    statuses.set(
      employeeId,
      employeeGoalStatusFromGoals(ownerKey, ownerGoals, {
        employeeId: maps.employeeIdByOwner.get(ownerKey) ?? ownerGoals[0]?.employeeId ?? null,
        ownerFullName: ownerGoals[0]?.ownerFullName ?? ownerGoals[0]?.employeeName ?? null,
        department: ownerGoals[0]?.organisationName ?? null,
        team: null,
        location: null,
        lineManagerKey: UNKNOWN_LINE_MANAGER.key,
        lineManagerName: UNKNOWN_LINE_MANAGER.name,
        lineManagerId: null,
        lineManagerEmail: null,
        reviewCycle: reviewCycle ?? ownerGoals[0]?.reviewCycle ?? null,
      }),
    )
  }

  return [...statuses.values()].sort((a, b) =>
    (a.ownerFullName ?? a.owner).localeCompare(b.ownerFullName ?? b.owner),
  )
}

export function buildGoalsMonitoringSummary(
  goals: GoalRecord[],
  options: {
    cycleFilter?: string | null
    calendarQuarter?: CalendarQuarter | null
    calendarYear?: number | null
    referenceDate?: Date
    performanceRecords?: PerformanceRecord[]
    ownerProfileLookup?: GoalOwnerProfileLookup
    activeRoster?: EmployeeDirectoryEntry[] | null
  } = {},
): GoalsMonitoringSummary {
  const cycleFilter = options.cycleFilter ?? null
  const ref = options.referenceDate ?? new Date()
  const ownerProfileLookup = options.ownerProfileLookup

  const locationByEmployeeId = new Map<string, string | null>()
  if (ownerProfileLookup) {
    for (const [id, profile] of ownerProfileLookup.byEmployeeId) {
      locationByEmployeeId.set(id, profile.location)
    }
    for (const [email, profile] of ownerProfileLookup.byEmail) {
      locationByEmployeeId.set(email, profile.location)
    }
  }

  const employees = buildEmployeeGoalStatuses(goals, cycleFilter, options.activeRoster ?? null, {
    locationByEmployeeId,
    calendarQuarter: options.calendarQuarter ?? null,
    calendarYear: options.calendarYear ?? null,
  })
  const rosterEmployees = employees.filter((employee) => !employee.exportOnly)
  /** When a People roster is in scope, metrics use roster rows only (not export-only goal owners). */
  const scopedEmployees = options.activeRoster?.length ? rosterEmployees : employees
  const total = scopedEmployees.length || 1

  const submittedEmployees = scopedEmployees.filter((e) => e.submitted)
  const fullyApproved = scopedEmployees.filter((e) => e.submitted && e.fullyApproved)
  const awaitingApprovalEmployees = scopedEmployees.filter(
    (e) => e.submitted && e.hasPendingApproval && !e.fullyApproved,
  )
  const withProgress = scopedEmployees.filter((e) => e.submitted && e.hasProgressUpdate)

  const notSubmitted = scopedEmployees.filter((e) => !e.submitted)
  const submittedNotApproved = scopedEmployees.filter((e) => e.submitted && !e.fullyApproved)
  const lowProgressUpdates = scopedEmployees.filter((e) => e.submitted && !e.hasProgressUpdate)

  const calendarQuarter = options.calendarQuarter ?? null
  const calendarYear = options.calendarYear ?? null

  let quarterStart: string | null = null
  let quarterDay: number | null = null
  let flagDay10: EmployeeGoalStatus[] = []
  let flagDay15: EmployeeGoalStatus[] = []
  let flagDay30: EmployeeGoalStatus[] = []
  let overdueDay30: EmployeeGoalStatus[] = []

  if (calendarQuarter != null && calendarYear != null) {
    quarterStart = quarterStartDate(calendarYear, calendarQuarter)
    quarterDay = dayOfQuarter(calendarYear, calendarQuarter, ref)
    if (quarterDay != null && quarterDay >= 10) flagDay10 = notSubmitted
    if (quarterDay != null && quarterDay >= 15) flagDay15 = notSubmitted
    if (quarterDay != null && quarterDay >= 30) {
      flagDay30 = notSubmitted
      overdueDay30 = submittedNotApproved
    }
  }

  const qualityWrongGoalCount = submittedEmployees.filter(
    (e) => e.submittedGoalCount < 3 || e.submittedGoalCount > 5,
  )

  const managerCompliance = buildManagerComplianceMetrics(
    goals,
    scopedEmployees,
    cycleFilter,
    ref,
  )

  const breakdownByDepartment = buildSubmissionBreakdownByKey(scopedEmployees, (employee) => {
    const dept = employee.department?.trim()
    if (dept) return dept
    if (ownerProfileLookup) {
      const label = employeeDepartmentLabel(employee, ownerProfileLookup)
      if (label !== '—') return label
    }
    return 'Unknown'
  })

  const breakdownByTeam = buildSubmissionBreakdownByKey(
    scopedEmployees,
    (employee) => employeeTeamBreakdownLabel(employee, ownerProfileLookup),
  ).sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))

  const breakdownByLocation = buildSubmissionBreakdownByKey(scopedEmployees, (employee) =>
    resolveEmployeeLocation(employee, ownerProfileLookup),
  )

  const breakdownByManager = buildManagerSubmissionBreakdown(scopedEmployees, ownerProfileLookup)

  const lowSubmissionDepartments = breakdownByDepartment
    .filter((row) => row.totalEmployees >= 3 && row.submittedPct < 60)
    .map((row) => ({
      department: row.label,
      totalEmployees: row.totalEmployees,
      submissionPct: row.submittedPct,
    }))
    .sort((a, b) => a.submissionPct - b.submissionPct)

  return {
    cycleFilter,
    calendarQuarter,
    calendarYear,
    quarterStartDate: quarterStart,
    quarterDay,
    totalOwners: scopedEmployees.length,
    submissionRatePct: pct(submittedEmployees.length, total),
    approvalRatePct: pct(fullyApproved.length, total),
    progressUpdateRatePct: pct(withProgress.length, total),
    submissionCounts: {
      submitted: {
        ...countBucket(submittedEmployees.length, total),
        goalCount: submittedEmployees.reduce((sum, employee) => sum + employee.submittedGoalCount, 0),
      },
      pendingSubmission: countBucket(notSubmitted.length, total),
      awaitingApproval: countBucket(awaitingApprovalEmployees.length, total),
      approvedLocked: countBucket(fullyApproved.length, total),
      overdueDay30NotApproved: countBucket(overdueDay30.length, total),
    },
    submitted: submittedEmployees,
    notSubmitted,
    awaitingApproval: awaitingApprovalEmployees,
    approvedLocked: fullyApproved,
    submittedNotApproved,
    lowProgressUpdates,
    flagDay10NotSubmitted: flagDay10,
    flagDay15NotSubmitted: flagDay15,
    flagDay30NotSubmitted: flagDay30,
    overdueDay30NotApproved: overdueDay30,
    managerCompliance,
    breakdownByDepartment,
    breakdownByTeam,
    breakdownByLocation,
    breakdownByManager,
    qualityWrongGoalCount,
    lowSubmissionDepartments,
  }
}

export function resolveEmployeeLocation(
  employee: EmployeeGoalStatus,
  lookup?: GoalOwnerProfileLookup,
): string {
  const fromEmployee =
    extractLocationLabel(employee.location) ??
    (lookup ? extractLocationLabel(resolveOwnerLocationRaw(employee, lookup)) : null)
  if (fromEmployee) return normalizeEmployeeLocation(fromEmployee)
  return 'Unknown'
}

function resolveOwnerLocationRaw(
  employee: EmployeeGoalStatus,
  lookup: GoalOwnerProfileLookup,
): string | null {
  const emailKey = employee.owner.trim().toLowerCase()
  const fromPerf =
    (employee.employeeId ? lookup.byEmployeeId.get(employee.employeeId) : undefined) ??
    lookup.byEmail.get(emailKey)
  return fromPerf?.location ?? null
}

function employeeDepartmentLabel(
  employee: EmployeeGoalStatus,
  lookup: GoalOwnerProfileLookup,
): string {
  if (employee.department?.trim()) return employee.department.trim()
  const emailKey = employee.owner.trim().toLowerCase()
  const fromPerf =
    (employee.employeeId ? lookup.byEmployeeId.get(employee.employeeId) : undefined) ??
    lookup.byEmail.get(emailKey)
  for (const g of employee.goals) {
    const name = (g.organisationName ?? '').trim()
    if (name) return name
  }
  return fromPerf?.department?.trim() || '—'
}

function employeeTeamBreakdownLabel(
  employee: EmployeeGoalStatus,
  lookup?: GoalOwnerProfileLookup,
): string {
  const team = employee.team?.trim()
  if (!team) return 'Unknown'
  const department = lookup
    ? employeeDepartmentLabel(employee, lookup)
    : employee.department?.trim() || '—'
  if (department && department !== '—') return `${team} · ${department}`
  return team
}

export function buildSubmissionBreakdownByKey(
  employees: EmployeeGoalStatus[],
  groupKey: (employee: EmployeeGoalStatus) => string,
): GoalBreakdownRow[] {
  const groups = new Map<string, EmployeeGoalStatus[]>()

  for (const employee of employees) {
    const key = groupKey(employee)
    const list = groups.get(key) ?? []
    list.push(employee)
    groups.set(key, list)
  }

  return [...groups.entries()]
    .map(([key, groupEmployees]) => {
      const totalEmployees = groupEmployees.length
      const submittedCount = groupEmployees.filter((e) => e.submitted).length
      const pendingSubmissionCount = groupEmployees.filter((e) => !e.submitted).length
      const awaitingApprovalCount = groupEmployees.filter(
        (e) => e.submitted && e.hasPendingApproval && !e.fullyApproved,
      ).length
      const approvedCount = groupEmployees.filter((e) => e.submitted && e.fullyApproved).length

      return {
        key,
        label: key,
        totalEmployees,
        submittedCount,
        submittedPct: pct(submittedCount, totalEmployees),
        pendingSubmissionCount,
        awaitingApprovalCount,
        approvedCount,
      }
    })
    .sort((a, b) => b.totalEmployees - a.totalEmployees || a.label.localeCompare(b.label))
}

export function buildSubmissionBreakdown(
  employees: EmployeeGoalStatus[],
  lookup: GoalOwnerProfileLookup,
  groupKey: (employee: EmployeeGoalStatus, lookup: GoalOwnerProfileLookup) => string,
): GoalBreakdownRow[] {
  const groups = new Map<string, EmployeeGoalStatus[]>()

  for (const employee of employees) {
    const key = groupKey(employee, lookup)
    const list = groups.get(key) ?? []
    list.push(employee)
    groups.set(key, list)
  }

  return [...groups.entries()]
    .map(([key, groupEmployees]) => {
      const totalEmployees = groupEmployees.length
      const submittedCount = groupEmployees.filter((e) => e.submitted).length
      const pendingSubmissionCount = groupEmployees.filter((e) => !e.submitted).length
      const awaitingApprovalCount = groupEmployees.filter(
        (e) => e.submitted && e.hasPendingApproval && !e.fullyApproved,
      ).length
      const approvedCount = groupEmployees.filter((e) => e.submitted && e.fullyApproved).length

      return {
        key,
        label: key,
        totalEmployees,
        submittedCount,
        submittedPct: pct(submittedCount, totalEmployees),
        pendingSubmissionCount,
        awaitingApprovalCount,
        approvedCount,
      }
    })
    .sort((a, b) => b.totalEmployees - a.totalEmployees || a.label.localeCompare(b.label))
}

function buildManagerSubmissionBreakdown(
  employees: EmployeeGoalStatus[],
  lookup?: GoalOwnerProfileLookup,
): GoalBreakdownRow[] {
  const groups = new Map<string, { managerName: string; employees: EmployeeGoalStatus[] }>()

  for (const employee of employees) {
    const key = employee.lineManagerKey
    const existing = groups.get(key)
    if (existing) {
      existing.employees.push(employee)
    } else {
      groups.set(key, {
        managerName: employee.lineManagerName,
        employees: [employee],
      })
    }
  }

  return [...groups.entries()]
    .map(([key, { managerName, employees: groupEmployees }]) => {
      const totalEmployees = groupEmployees.length
      const submittedCount = groupEmployees.filter((e) => e.submitted).length
      const pendingSubmissionCount = groupEmployees.filter((e) => !e.submitted).length
      const awaitingApprovalCount = groupEmployees.filter(
        (e) => e.submitted && e.hasPendingApproval && !e.fullyApproved,
      ).length
      const approvedCount = groupEmployees.filter((e) => e.submitted && e.fullyApproved).length
      const sample = groupEmployees[0]

      return {
        key,
        label: managerName,
        avatarUrl: lookup
          ? resolveProfileAvatar(lookup, sample.lineManagerId, sample.lineManagerEmail)
          : null,
        totalEmployees,
        submittedCount,
        submittedPct: pct(submittedCount, totalEmployees),
        pendingSubmissionCount,
        awaitingApprovalCount,
        approvedCount,
      }
    })
    .sort((a, b) => b.totalEmployees - a.totalEmployees || a.label.localeCompare(b.label))
}

export function buildManagerComplianceMetrics(
  goals: GoalRecord[],
  employees: EmployeeGoalStatus[],
  cycleFilter: string | null,
  referenceDate: Date,
): ManagerComplianceMetrics {
  const aggregates = aggregateGoalsById(goals).filter((g) => matchesCycle(g, cycleFilter))
  const teamSummaries = buildManagerTeamSummaries(employees, aggregates, referenceDate).filter(
    (row) => row.manager.key !== UNKNOWN_LINE_MANAGER.key,
  )

  const managersInScope = teamSummaries.length
  const managersWithSubmittedTeam = teamSummaries.filter((m) => m.submittedCount > 0).length
  const managersAllTeamApprovedCount = teamSummaries.filter(
    (m) => m.submittedCount > 0 && m.allTeamApproved,
  ).length

  const approvalDeltas: number[] = []
  for (const goal of aggregates) {
    if (!isEmployeeKpi(goal) || !isSubmittedGoal(goal)) continue
    if (goal.approvalStatus !== APPROVED_APPROVAL) continue
    const submitted = parseDate(goal.submittedAt)
    const approved = parseDate(goal.approvedAt)
    if (!submitted || !approved) continue
    const delta = daysBetween(submitted, approved)
    if (delta >= 0) approvalDeltas.push(delta)
  }

  const avgDaysSubmissionToApproval =
    approvalDeltas.length > 0
      ? Math.round(
          (approvalDeltas.reduce((sum, value) => sum + value, 0) / approvalDeltas.length) * 10,
        ) / 10
      : null

  return {
    managersInScope,
    managersWithSubmittedTeam,
    managersAllTeamApprovedPct: pct(managersAllTeamApprovedCount, managersWithSubmittedTeam || 1),
    managersAllTeamApprovedCount,
    avgDaysSubmissionToApproval,
    managersZeroTeamSubmitted: teamSummaries.filter((m) => m.zeroTeamSubmitted),
    managersPendingOver5Days: teamSummaries.filter(
      (m) => m.pendingApprovalGoalCount > 0 && (m.oldestPendingDays ?? 0) > 5,
    ),
  }
}

export function buildManagerTeamSummaries(
  employees: EmployeeGoalStatus[],
  aggregates: GoalAggregate[],
  referenceDate: Date,
): ManagerTeamSummary[] {
  const byManager = new Map<string, { manager: LineManagerInfo; employees: EmployeeGoalStatus[] }>()

  for (const employee of employees) {
    const manager: LineManagerInfo = {
      key: employee.lineManagerKey,
      id: employee.lineManagerId,
      name: employee.lineManagerName,
      email: employee.lineManagerEmail,
    }
    const existing = byManager.get(manager.key)
    if (existing) {
      existing.employees.push(employee)
    } else {
      byManager.set(manager.key, { manager, employees: [employee] })
    }
  }

  const pendingGoalsByOwner = new Map<string, GoalAggregate[]>()
  for (const goal of aggregates) {
    if (!isEmployeeKpi(goal) || !isSubmittedGoal(goal)) continue
    if (goal.approvalStatus !== PENDING_APPROVAL) continue
    const list = pendingGoalsByOwner.get(goal.owner) ?? []
    list.push(goal)
    pendingGoalsByOwner.set(goal.owner, list)
  }

  return [...byManager.values()]
    .map(({ manager, employees: teamEmployees }) => {
      const teamSize = teamEmployees.length
      const submittedCount = teamEmployees.filter((e) => e.submitted).length
      const fullyApprovedCount = teamEmployees.filter((e) => e.submitted && e.fullyApproved).length
      let pendingApprovalGoalCount = 0
      let oldestPendingDays: number | null = null

      for (const employee of teamEmployees) {
        const pendingGoals = pendingGoalsByOwner.get(employee.owner) ?? []
        pendingApprovalGoalCount += pendingGoals.length
        for (const goal of pendingGoals) {
          const submitted = parseDate(goal.submittedAt)
          if (!submitted) continue
          const daysPending = daysBetween(submitted, referenceDate)
          if (daysPending >= 0) {
            oldestPendingDays =
              oldestPendingDays == null ? daysPending : Math.max(oldestPendingDays, daysPending)
          }
        }
      }

      return {
        manager,
        teamSize,
        submittedCount,
        fullyApprovedCount,
        pendingApprovalGoalCount,
        oldestPendingDays,
        allTeamApproved: submittedCount > 0 && fullyApprovedCount === submittedCount,
        zeroTeamSubmitted: teamSize > 0 && submittedCount === 0,
      }
    })
    .sort((a, b) => a.manager.name.localeCompare(b.manager.name))
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
    ? records.filter((r) => reviewCyclesMatch(cycleFilter, r.cycle_name))
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
