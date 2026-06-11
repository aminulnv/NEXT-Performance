import { describe, expect, it } from 'vitest'
import {
  buildGoalOwnerProfileLookup,
  buildLineManagerLookup,
  enrichGoalOwnerProfileLookup,
  extractLocationLabel,
  employeeToFlagPersonRow,
  managerPendingToFlagPersonRow,
  formatEmployeeCountry,
  normalizeEmployeeLocation,
  resolveDirectoryEmployeeCountry,
  resolveLineManagerForOwner,
  sortMonitoringCountryLabels,
} from '@/lib/goalOwnerProfiles'
import type { EmployeeDirectoryEntry } from '@/types/employee'
import type { EmployeeGoalStatus } from '@/lib/goalsMonitoring'
import type { PerformanceRecord } from '@/types/performance'

function employee(partial: Partial<EmployeeGoalStatus>): EmployeeGoalStatus {
  return {
    owner: 'alice@co.com',
    ownerFullName: 'Alice Smith',
    employeeId: 'emp-1',
    department: null,
    location: null,
    lineManagerKey: '__unknown__',
    lineManagerName: 'Unknown line manager',
    lineManagerId: null,
    lineManagerEmail: null,
    reviewCycle: null,
    employeeGoalCount: 1,
    submittedGoalCount: 0,
    submitted: false,
    fullyApproved: false,
    hasPendingApproval: false,
    hasProgressUpdate: false,
    goals: [],
    ...partial,
  }
}

describe('extractLocationLabel', () => {
  it('reads location name from Revolut object payloads', () => {
    expect(extractLocationLabel({ name: 'Malaysia Office' })).toBe('Malaysia Office')
    expect(extractLocationLabel('[object Object]')).toBeNull()
  })

  it('normalizes known office labels to full country names', () => {
    expect(normalizeEmployeeLocation('Malaysia Office')).toBe('Malaysia')
    expect(normalizeEmployeeLocation({ name: 'Sri Lanka' })).toBe('Sri Lanka')
    expect(normalizeEmployeeLocation('BD')).toBe('Bangladesh')
  })
})

describe('resolveDirectoryEmployeeCountry', () => {
  const directoryEntry: EmployeeDirectoryEntry = {
    id: 'emp-1',
    remoteId: null,
    name: 'Alice',
    fullName: 'Alice',
    firstName: null,
    middleName: null,
    lastName: null,
    email: 'alice@co.com',
    avatar: null,
    department: null,
    team: null,
    location: 'Malaysia Office',
    entity: null,
    joiningDateTime: null,
    terminationDateTime: null,
    updatedDateTime: null,
    status: 'active',
    inactivityReason: null,
    specialisation: null,
    seniority: null,
    candidateId: null,
    lineManagerId: null,
    lineManagerName: null,
    lineManagerEmail: null,
  }

  it('normalizes directory location to country label', () => {
    expect(resolveDirectoryEmployeeCountry(directoryEntry)).toBe('Malaysia')
    expect(formatEmployeeCountry(directoryEntry)).toBe('Malaysia')
  })

  it('sorts known countries before other labels', () => {
    expect(
      sortMonitoringCountryLabels(['London', 'Malaysia', 'Unknown', 'Sri Lanka']),
    ).toEqual(['Malaysia', 'Sri Lanka', 'Unknown', 'London'])
  })
})

describe('enrichGoalOwnerProfileLookup', () => {
  it('replaces corrupted performance location with directory location', () => {
    const records: PerformanceRecord[] = [
      {
        id: '1',
        sync_run_id: null,
        grade_record_id: null,
        employee_id: 'emp-1',
        cycle_id: null,
        employee_name: 'Alice',
        cycle_name: null,
        department: null,
        team: null,
        display_grade: null,
        line_manager_grade: null,
        calculated_grade: null,
        absolute_rating: null,
        ranking_score: null,
        payload: { 'Employee Location': { name: 'Malaysia Office' } },
        synced_at: '2026-01-01',
      },
    ]
    const directory: EmployeeDirectoryEntry[] = [
      {
        id: 'emp-1',
        remoteId: null,
        name: 'Alice',
        fullName: 'Alice',
        firstName: null,
        middleName: null,
        lastName: null,
        email: 'alice@co.com',
        avatar: null,
        department: null,
        team: null,
        location: 'Sri Lanka',
        entity: null,
        joiningDateTime: null,
        terminationDateTime: null,
        updatedDateTime: null,
        status: 'active',
        inactivityReason: null,
        specialisation: null,
        seniority: null,
        candidateId: null,
        lineManagerId: null,
        lineManagerName: null,
        lineManagerEmail: null,
      },
    ]

    const lookup = enrichGoalOwnerProfileLookup(buildGoalOwnerProfileLookup(records), directory)
    expect(lookup.byEmployeeId.get('emp-1')?.location).toBe('Sri Lanka')
  })
})

describe('employeeToFlagPersonRow', () => {
  it('uses performance department and avatar when matched by employee id', () => {
    const records: PerformanceRecord[] = [
      {
        id: '1',
        sync_run_id: null,
        grade_record_id: null,
        employee_id: 'emp-1',
        cycle_id: null,
        employee_name: 'Alice Smith',
        cycle_name: null,
        department: 'Engineering',
        team: null,
        display_grade: null,
        line_manager_grade: null,
        calculated_grade: null,
        absolute_rating: null,
        ranking_score: null,
        payload: { 'Employee Avatar URL': 'https://example.com/a.png' },
        synced_at: '2026-01-01',
      },
    ]
    const row = employeeToFlagPersonRow(employee({}), buildGoalOwnerProfileLookup(records))
    expect(row.name).toBe('Alice Smith')
    expect(row.department).toBe('Engineering')
    expect(row.avatarUrl).toBe('https://example.com/a.png')
  })

  it('falls back to organisation name from goals', () => {
    const row = employeeToFlagPersonRow(
      employee({
        employeeId: null,
        goals: [
          {
            goalId: '1',
            title: 'G',
            owner: 'alice@co.com',
            ownerFullName: 'Alice',
            employeeId: null,
            employeeName: null,
            reviewCycle: null,
            organisationUnit: 'Employee Kpi',
            organisationName: 'Product',
            approvalStatus: null,
            goalStatus: null,
            hasMetrics: false,
            hasProgressUpdate: false,
            submittedAt: null,
            approvedAt: null,
          },
        ],
      }),
      buildGoalOwnerProfileLookup([]),
    )
    expect(row.department).toBe('Product')
  })

  it('includes employee id for person detail navigation', () => {
    const row = employeeToFlagPersonRow(employee({ employeeId: 'emp-42' }), buildGoalOwnerProfileLookup([]))
    expect(row.employeeId).toBe('emp-42')
  })

  it('includes submitted goal count', () => {
    const row = employeeToFlagPersonRow(
      employee({ submittedGoalCount: 4, submitted: true }),
      buildGoalOwnerProfileLookup([]),
    )
    expect(row.submittedGoalCount).toBe(4)
  })

  it('includes line manager name', () => {
    const row = employeeToFlagPersonRow(
      employee({ lineManagerName: 'Bob Manager' }),
      buildGoalOwnerProfileLookup([]),
    )
    expect(row.managerName).toBe('Bob Manager')
  })

  it('resolves manager avatar from performance records', () => {
    const records: PerformanceRecord[] = [
      {
        id: '1',
        sync_run_id: null,
        grade_record_id: null,
        employee_id: 'mgr-1',
        cycle_id: null,
        employee_name: 'Bob Manager',
        cycle_name: null,
        department: null,
        team: null,
        display_grade: null,
        line_manager_grade: null,
        calculated_grade: null,
        absolute_rating: null,
        ranking_score: null,
        payload: { 'Employee Avatar URL': 'https://example.com/bob.png' },
        synced_at: '2026-01-01',
      },
    ]
    const row = employeeToFlagPersonRow(
      employee({
        lineManagerName: 'Bob Manager',
        lineManagerId: 'mgr-1',
        lineManagerEmail: 'bob@co.com',
      }),
      buildGoalOwnerProfileLookup(records),
    )
    expect(row.managerAvatarUrl).toBe('https://example.com/bob.png')
  })

  it('falls back when line manager is unknown', () => {
    const row = employeeToFlagPersonRow(
      employee({ lineManagerName: 'Unknown line manager' }),
      buildGoalOwnerProfileLookup([]),
    )
    expect(row.managerName).toBe('—')
  })
})

describe('buildLineManagerLookup', () => {
  it('resolves line manager by employee id and email', () => {
    const records: PerformanceRecord[] = [
      {
        id: '1',
        sync_run_id: null,
        grade_record_id: null,
        employee_id: 'emp-1',
        cycle_id: null,
        employee_name: 'Alice',
        cycle_name: null,
        department: null,
        team: null,
        display_grade: null,
        line_manager_grade: null,
        calculated_grade: null,
        absolute_rating: null,
        ranking_score: null,
        payload: {
          'Employee Email': 'alice@co.com',
          'Line Manager (HR profile)': 'Bob Manager',
          'Line Manager (HR profile) Email': 'bob@co.com',
        },
        synced_at: '2026-01-01',
      },
    ]
    const lookup = buildLineManagerLookup(records)
    expect(resolveLineManagerForOwner('alice@co.com', 'emp-1', lookup)?.name).toBe('Bob Manager')
  })
})

describe('managerPendingToFlagPersonRow', () => {
  it('includes pending goal count on the row', () => {
    const row = managerPendingToFlagPersonRow(
      {
        manager: { key: 'bob@co.com', id: null, name: 'Bob Manager', email: 'bob@co.com' },
        pendingGoalCount: 3,
      },
      buildGoalOwnerProfileLookup([]),
    )
    expect(row.pendingGoalCount).toBe(3)
    expect(row.name).toBe('Bob Manager')
  })
})
