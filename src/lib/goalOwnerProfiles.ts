import type { EmployeeGoalStatus } from '@/lib/goalsMonitoring'
import type { PerformanceRecord } from '@/types/performance'

export type FlagPersonRow = {
  id: string
  name: string
  department: string
  avatarUrl: string | null
  pendingGoalCount?: number
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
    fromPerf?.department?.trim() ||
    departmentFromGoals(employee)?.trim() ||
    '—'

  return {
    id: employee.owner,
    name: employee.ownerFullName?.trim() || employee.owner,
    department,
    avatarUrl: fromPerf?.avatarUrl ?? null,
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
  const cycle = (record.cycle_name ?? '').trim().toLowerCase()
  return cycle === cycleFilter.trim().toLowerCase() ? 1 : 0
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
    name: row.manager.name,
    department: fromPerf?.department?.trim() || '—',
    avatarUrl: fromPerf?.avatarUrl ?? null,
    pendingGoalCount: row.pendingGoalCount,
  }
}
