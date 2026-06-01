import {
  formatQuarterYear,
  isJoiningCutoffActiveForQuarter,
  quarterStartDate,
  type CalendarQuarter,
} from '@/lib/calendarQuarters'
import type { EmployeeDirectoryEntry } from '@/types/employee'
import type { PerformanceRecord } from '@/types/performance'

/** Matches `employees.status = 'Active'` in Supabase / Revolut People directory. */
export function isActiveEmployee(status: string | null | undefined): boolean {
  return (status ?? '').trim().toLowerCase() === 'active'
}

export function filterActiveEmployees(
  employees: EmployeeDirectoryEntry[],
): EmployeeDirectoryEntry[] {
  return employees.filter((employee) => isActiveEmployee(employee.status))
}

function parseJoiningDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date
}

/** Active employees eligible for a quarter's goal metrics (joining-date cutoff from Q2 2026). */
export function isEmployeeEligibleForQuarter(
  employee: EmployeeDirectoryEntry,
  year: number,
  quarter: CalendarQuarter,
): boolean {
  if (!isActiveEmployee(employee.status)) return false
  if (!isJoiningCutoffActiveForQuarter(year, quarter)) return true

  const joiningDate = parseJoiningDate(employee.joiningDateTime)
  if (!joiningDate) return false

  const cutoff = new Date(quarterStartDate(year, quarter))
  cutoff.setHours(0, 0, 0, 0)
  return joiningDate.getTime() <= cutoff.getTime()
}

export function filterEmployeesForQuarter(
  employees: EmployeeDirectoryEntry[],
  year: number,
  quarter: CalendarQuarter,
): EmployeeDirectoryEntry[] {
  if (!isJoiningCutoffActiveForQuarter(year, quarter)) {
    return filterActiveEmployees(employees)
  }
  return employees.filter((employee) => isEmployeeEligibleForQuarter(employee, year, quarter))
}

/** Stat card label and hint for monitoring headcount. */
export function employeesInScopeLabel(
  quarter: CalendarQuarter | null,
  year: number | null,
): { label: string; hint: string } {
  if (quarter == null || year == null) {
    return {
      label: 'Total employees',
      hint: 'Active · People directory (select a quarter for joining-date scope)',
    }
  }

  const quarterLabel = formatQuarterYear(quarter, year)
  const start = quarterStartDate(year, quarter)
  const cutoffLabel = new Date(`${start}T12:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  if (isJoiningCutoffActiveForQuarter(year, quarter)) {
    return {
      label: `Employees in scope (${quarterLabel})`,
      hint: `Active · joined on or before ${cutoffLabel}`,
    }
  }

  return {
    label: `Employees in scope (${quarterLabel})`,
    hint: 'Active · People directory',
  }
}

export function buildActiveEmployeeKeys(roster: EmployeeDirectoryEntry[]): {
  ids: Set<string>
  emails: Set<string>
} {
  const ids = new Set<string>()
  const emails = new Set<string>()
  for (const employee of filterActiveEmployees(roster)) {
    ids.add(employee.id)
    if (employee.remoteId) ids.add(employee.remoteId)
    const email = employee.email?.trim().toLowerCase()
    if (email) emails.add(email)
  }
  return { ids, emails }
}

function employeeEmailFromRecord(record: PerformanceRecord): string | null {
  const raw = record.payload?.['Employee Email']
  if (raw == null) return null
  const email = String(raw).trim().toLowerCase()
  return email || null
}

/** Performance records for employees in the active People directory roster. */
export function filterRecordsByActiveEmployees(
  records: PerformanceRecord[],
  roster: EmployeeDirectoryEntry[],
): PerformanceRecord[] {
  const { ids, emails } = buildActiveEmployeeKeys(roster)
  if (ids.size === 0 && emails.size === 0) return []

  return records.filter((record) => {
    if (record.employee_id && ids.has(record.employee_id)) return true
    const email = employeeEmailFromRecord(record)
    return email != null && emails.has(email)
  })
}
