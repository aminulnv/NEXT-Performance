import type { EmployeeGoalStatus } from '@/lib/goalsMonitoring'
import { reviewCyclesMatch } from '@/lib/calendarQuarters'
import type { EmployeeDirectoryEntry } from '@/types/employee'
import type { PerformanceRecord } from '@/types/performance'

export type FlagPersonRow = {
  id: string
  employeeId: string | null
  name: string
  department: string
  managerName: string
  managerAvatarUrl: string | null
  avatarUrl: string | null
  submittedGoalCount?: number
  pendingGoalCount?: number
  teamSize?: number
  oldestPendingDays?: number | null
}

export type LineManagerInfo = {
  key: string
  id: string | null
  name: string
  email: string | null
}

export type LineManagerLookup = {
  byEmployeeId: Map<string, LineManagerInfo>
  byEmployeeEmail: Map<string, LineManagerInfo>
}

export type ManagerPendingApproval = {
  manager: LineManagerInfo
  pendingGoalCount: number
}

type OwnerProfile = {
  department: string | null
  avatarUrl: string | null
  location: string | null
}

export type GoalOwnerProfileLookup = {
  byEmployeeId: Map<string, OwnerProfile>
  byEmail: Map<string, OwnerProfile>
}

function payloadStr(payload: Record<string, unknown>, key: string): string | null {
  const v = payload[key]
  if (v == null) return null
  const s = String(v).trim()
  return s || null
}

export function buildGoalOwnerProfileLookup(
  records: PerformanceRecord[],
): GoalOwnerProfileLookup {
  const byEmployeeId = new Map<string, OwnerProfile>()
  const byEmail = new Map<string, OwnerProfile>()

  for (const r of records) {
    const profile: OwnerProfile = {
      department: r.department,
      avatarUrl: payloadStr(r.payload, 'Employee Avatar URL'),
      location: payloadStr(r.payload, 'Employee Location'),
    }
    if (r.employee_id) {
      const existing = byEmployeeId.get(r.employee_id)
      if (!existing?.department && profile.department) {
        byEmployeeId.set(r.employee_id, profile)
      } else if (!existing) {
        byEmployeeId.set(r.employee_id, profile)
      }
    }
    const email = payloadStr(r.payload, 'Employee Email')?.toLowerCase()
    if (email) {
      const existing = byEmail.get(email)
      if (!existing?.department && profile.department) {
        byEmail.set(email, profile)
      } else if (!existing) {
        byEmail.set(email, profile)
      }
    }
  }

  return { byEmployeeId, byEmail }
}

export function enrichGoalOwnerProfileLookup(
  lookup: GoalOwnerProfileLookup,
  directory: EmployeeDirectoryEntry[],
): GoalOwnerProfileLookup {
  const byEmployeeId = new Map(lookup.byEmployeeId)
  const byEmail = new Map(lookup.byEmail)

  const merge = (existing: OwnerProfile | undefined, incoming: OwnerProfile): OwnerProfile => ({
    department: existing?.department ?? incoming.department,
    avatarUrl: existing?.avatarUrl ?? incoming.avatarUrl,
    location: existing?.location ?? incoming.location,
  })

  for (const employee of directory) {
    const profile: OwnerProfile = {
      department: employee.department?.trim() || null,
      avatarUrl: employee.avatar?.trim() || null,
      location: employee.location?.trim() || null,
    }
    if (employee.id) {
      byEmployeeId.set(employee.id, merge(byEmployeeId.get(employee.id), profile))
    }
    const email = employee.email?.trim().toLowerCase()
    if (email) {
      byEmail.set(email, merge(byEmail.get(email), profile))
    }
  }

  return { byEmployeeId, byEmail }
}

export function resolveProfileAvatar(
  lookup: GoalOwnerProfileLookup,
  employeeId: string | null | undefined,
  email: string | null | undefined,
): string | null {
  if (employeeId) {
    const fromId = lookup.byEmployeeId.get(employeeId)
    if (fromId?.avatarUrl) return fromId.avatarUrl
  }
  const emailKey = email?.trim().toLowerCase()
  if (emailKey) {
    const fromEmail = lookup.byEmail.get(emailKey)
    if (fromEmail?.avatarUrl) return fromEmail.avatarUrl
  }
  if (employeeId) return lookup.byEmployeeId.get(employeeId)?.avatarUrl ?? null
  return null
}

export function normalizeEmployeeLocation(raw: string | null | undefined): string {
  if (!raw?.trim()) return 'Unknown'
  const s = raw.trim().toLowerCase()
  if (s.includes('malaysia') || s === 'my') return 'MY'
  if (s.includes('sri lanka') || s === 'sl') return 'SL'
  if (s.includes('cyprus')) return 'Cyprus'
  if (s.includes('bangladesh') || s === 'bd') return 'BD'
  return raw.trim()
}

export function resolveOwnerLocation(
  employee: EmployeeGoalStatus,
  lookup: GoalOwnerProfileLookup,
): string {
  const emailKey = employee.owner.trim().toLowerCase()
  const fromPerf =
    (employee.employeeId ? lookup.byEmployeeId.get(employee.employeeId) : undefined) ??
    lookup.byEmail.get(emailKey)
  return normalizeEmployeeLocation(fromPerf?.location)
}

function departmentFromGoals(employee: EmployeeGoalStatus): string | null {
  for (const g of employee.goals) {
    const name = (g.organisationName ?? '').trim()
    if (name) return name
  }
  return null
}

export function employeeToFlagPersonRow(
  employee: EmployeeGoalStatus,
  lookup: GoalOwnerProfileLookup,
): FlagPersonRow {
  const emailKey = employee.owner.trim().toLowerCase()
  const fromPerf =
    (employee.employeeId ? lookup.byEmployeeId.get(employee.employeeId) : undefined) ??
    lookup.byEmail.get(emailKey)

  const department =
    employee.department?.trim() ||
    fromPerf?.department?.trim() ||
    departmentFromGoals(employee)?.trim() ||
    '—'

  const managerRaw = employee.lineManagerName?.trim()
  const managerName =
    managerRaw && managerRaw.toLowerCase() !== 'unknown line manager' ? managerRaw : '—'

  return {
    id: employee.owner,
    employeeId: employee.employeeId,
    name: employee.ownerFullName?.trim() || employee.owner,
    department,
    managerName,
    managerAvatarUrl:
      managerName === '—'
        ? null
        : resolveProfileAvatar(lookup, employee.lineManagerId, employee.lineManagerEmail),
    avatarUrl: fromPerf?.avatarUrl ?? null,
    submittedGoalCount: employee.submittedGoalCount,
  }
}

const LINE_MANAGER_NAME_KEYS = ['Line Manager (HR profile)', 'Line Manager (cycle)'] as const
const LINE_MANAGER_ID_KEYS = ['Line Manager (HR profile) ID', 'Line Manager (cycle) ID'] as const
const LINE_MANAGER_EMAIL_KEY = 'Line Manager (HR profile) Email'

function lineManagerFromRecord(record: PerformanceRecord): LineManagerInfo | null {
  const payload = record.payload ?? {}
  let name: string | null = null
  for (const key of LINE_MANAGER_NAME_KEYS) {
    name = payloadStr(payload, key)
    if (name) break
  }
  if (!name) return null

  let id: string | null = null
  for (const key of LINE_MANAGER_ID_KEYS) {
    id = payloadStr(payload, key)
    if (id) break
  }
  const email = payloadStr(payload, LINE_MANAGER_EMAIL_KEY)?.toLowerCase() ?? null
  const key = email ?? id ?? name.trim().toLowerCase()

  return { key, id, name: name.trim(), email }
}

function recordCycleScore(record: PerformanceRecord, cycleFilter: string | null): number {
  if (!cycleFilter) return 0
  return reviewCyclesMatch(cycleFilter, record.cycle_name) ? 1 : 0
}

export function buildLineManagerLookup(
  records: PerformanceRecord[],
  cycleFilter: string | null = null,
): LineManagerLookup {
  const byEmployeeId = new Map<string, LineManagerInfo>()
  const byEmployeeEmail = new Map<string, LineManagerInfo>()

  const sorted = [...records].sort(
    (a, b) => recordCycleScore(b, cycleFilter) - recordCycleScore(a, cycleFilter),
  )

  for (const record of sorted) {
    const manager = lineManagerFromRecord(record)
    if (!manager) continue

    if (record.employee_id && !byEmployeeId.has(record.employee_id)) {
      byEmployeeId.set(record.employee_id, manager)
    }

    const employeeEmail = payloadStr(record.payload, 'Employee Email')?.toLowerCase()
    if (employeeEmail && !byEmployeeEmail.has(employeeEmail)) {
      byEmployeeEmail.set(employeeEmail, manager)
    }
  }

  return { byEmployeeId, byEmployeeEmail }
}

export function resolveLineManagerForOwner(
  owner: string,
  employeeId: string | null,
  lookup: LineManagerLookup,
): LineManagerInfo | null {
  if (employeeId) {
    const fromId = lookup.byEmployeeId.get(employeeId)
    if (fromId) return fromId
  }
  const emailKey = owner.trim().toLowerCase()
  if (emailKey) return lookup.byEmployeeEmail.get(emailKey) ?? null
  return null
}

export function managerTeamToFlagPersonRow(
  row: {
    manager: LineManagerInfo
    teamSize: number
    pendingApprovalGoalCount: number
    oldestPendingDays: number | null
  },
  lookup: GoalOwnerProfileLookup,
): FlagPersonRow {
  const emailKey = row.manager.email
  const fromPerf =
    (emailKey ? lookup.byEmail.get(emailKey) : undefined) ??
    (row.manager.id ? lookup.byEmployeeId.get(row.manager.id) : undefined)

  return {
    id: row.manager.key,
    employeeId: row.manager.id,
    name: row.manager.name,
    department: fromPerf?.department?.trim() || '—',
    managerName: '—',
    managerAvatarUrl: null,
    avatarUrl: fromPerf?.avatarUrl ?? null,
    pendingGoalCount: row.pendingApprovalGoalCount,
    teamSize: row.teamSize,
    oldestPendingDays: row.oldestPendingDays,
  }
}

export function managerPendingToFlagPersonRow(
  row: ManagerPendingApproval,
  lookup: GoalOwnerProfileLookup,
): FlagPersonRow {
  const emailKey = row.manager.email
  const fromPerf =
    (emailKey ? lookup.byEmail.get(emailKey) : undefined) ??
    (row.manager.id ? lookup.byEmployeeId.get(row.manager.id) : undefined)

  return {
    id: row.manager.key,
    employeeId: row.manager.id,
    name: row.manager.name,
    department: fromPerf?.department?.trim() || '—',
    managerName: '—',
    managerAvatarUrl: null,
    avatarUrl: fromPerf?.avatarUrl ?? null,
    pendingGoalCount: row.pendingGoalCount,
  }
}
