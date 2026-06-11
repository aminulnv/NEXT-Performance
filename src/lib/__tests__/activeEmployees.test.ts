import { describe, expect, it } from 'vitest'
import {
  employeesInScopeLabel,
  filterActiveEmployees,
  filterEmployeesForQuarter,
  filterRecordsByActiveEmployees,
  isActiveEmployee,
  isEmployeeEligibleForQuarter,
} from '@/lib/activeEmployees'
import { quarterStartDate } from '@/lib/calendarQuarters'
import type { EmployeeDirectoryEntry } from '@/types/employee'
import type { PerformanceRecord } from '@/types/performance'

function entry(
  status: string | null,
  partial: Partial<EmployeeDirectoryEntry> = {},
): EmployeeDirectoryEntry {
  return {
    id: '1',
    remoteId: null,
    name: 'Test',
    fullName: null,
    firstName: null,
    middleName: null,
    lastName: null,
    email: 'test@co.com',
    avatar: null,
    department: null,
    team: null,
    location: null,
    entity: null,
    joiningDateTime: null,
    terminationDateTime: null,
    updatedDateTime: null,
    status,
    inactivityReason: null,
    specialisation: null,
    seniority: null,
    candidateId: null,
    lineManagerId: null,
    lineManagerName: null,
    lineManagerEmail: null,
    ...partial,
  }
}

function performanceRecord(
  partial: Partial<PerformanceRecord> & Pick<PerformanceRecord, 'id'>,
): PerformanceRecord {
  return {
    sync_run_id: null,
    grade_record_id: null,
    employee_id: null,
    cycle_id: null,
    employee_name: null,
    cycle_name: null,
    department: null,
    team: null,
    display_grade: null,
    line_manager_grade: null,
    calculated_grade: null,
    absolute_rating: null,
    ranking_score: null,
    payload: {},
    synced_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

describe('isActiveEmployee', () => {
  it('matches only Active status (case-insensitive)', () => {
    expect(isActiveEmployee('Active')).toBe(true)
    expect(isActiveEmployee('active')).toBe(true)
    expect(isActiveEmployee(' ACTIVE ')).toBe(true)
  })

  it('excludes empty, null, and other statuses', () => {
    expect(isActiveEmployee(null)).toBe(false)
    expect(isActiveEmployee('')).toBe(false)
    expect(isActiveEmployee('terminated')).toBe(false)
    expect(isActiveEmployee('inactive')).toBe(false)
    expect(isActiveEmployee('left')).toBe(false)
    expect(isActiveEmployee('employed')).toBe(false)
  })
})

describe('filterActiveEmployees', () => {
  it('returns only Active rows', () => {
    const rows = filterActiveEmployees([
      entry('Active'),
      entry('terminated'),
      entry(null),
      entry('Inactive'),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('Active')
  })
})

describe('quarter joining cutoff', () => {
  it('includes employees who joined on the quarter start date from Q2 2026', () => {
    expect(
      isEmployeeEligibleForQuarter(
        entry('Active', { joiningDateTime: '2026-04-01T09:00:00Z' }),
        2026,
        2,
      ),
    ).toBe(true)
  })

  it('excludes employees who joined after the quarter start from Q2 2026', () => {
    expect(
      isEmployeeEligibleForQuarter(
        entry('Active', { joiningDateTime: '2026-04-02T00:00:00Z' }),
        2026,
        2,
      ),
    ).toBe(false)
  })

  it('does not apply cutoff before Q2 2026', () => {
    expect(
      isEmployeeEligibleForQuarter(
        entry('Active', { joiningDateTime: '2026-04-02T00:00:00Z' }),
        2026,
        1,
      ),
    ).toBe(true)
  })

  it('filters roster for a quarter', () => {
    const rows = filterEmployeesForQuarter(
      [
        entry('Active', { id: '1', joiningDateTime: '2026-03-01' }),
        entry('Active', { id: '2', joiningDateTime: '2026-04-01' }),
        entry('Active', { id: '3', joiningDateTime: '2026-04-02' }),
        entry('Inactive', { id: '4', joiningDateTime: '2026-01-01' }),
      ],
      2026,
      2,
    )
    expect(rows.map((row) => row.id)).toEqual(['1', '2'])
  })
})

describe('employeesInScopeLabel', () => {
  it('prompts for quarter selection when no quarter is chosen', () => {
    expect(employeesInScopeLabel(null, null)).toEqual({
      label: 'Total employees',
      hint: 'Active · People directory (select a quarter for joining-date scope)',
    })
  })

  it('includes cutoff date for Q2 2026 onward', () => {
    const { label, hint } = employeesInScopeLabel(2, 2026)
    const cutoffLabel = new Date(`${quarterStartDate(2026, 2)}T12:00:00`).toLocaleDateString(
      undefined,
      { day: 'numeric', month: 'short', year: 'numeric' },
    )
    expect(label).toBe('Employees in scope (Q2 2026)')
    expect(hint).toContain('joined on or before')
    expect(hint).toContain(cutoffLabel)
  })
})

describe('filterRecordsByActiveEmployees', () => {
  const roster = [
    entry('Active', { id: 'emp-a', email: 'alice@co.com' }),
    entry('terminated', { id: 'emp-b', email: 'bob@co.com' }),
  ]

  it('keeps records for active employees by id', () => {
    const records = [
      performanceRecord({ id: 'r1', employee_id: 'emp-a' }),
      performanceRecord({ id: 'r2', employee_id: 'emp-b' }),
    ]
    expect(filterRecordsByActiveEmployees(records, roster)).toEqual([records[0]])
  })

  it('matches active employees by email when id is missing', () => {
    const records = [
      performanceRecord({
        id: 'r1',
        payload: { 'Employee Email': 'alice@co.com' },
      }),
    ]
    expect(filterRecordsByActiveEmployees(records, roster)).toEqual(records)
  })
})
