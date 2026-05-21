import { describe, expect, it } from 'vitest'
import {
  buildGoalOwnerProfileLookup,
  buildLineManagerLookup,
  employeeToFlagPersonRow,
  managerPendingToFlagPersonRow,
  resolveLineManagerForOwner,
} from '@/lib/goalOwnerProfiles'
import type { EmployeeGoalStatus } from '@/lib/goalsMonitoring'
import type { PerformanceRecord } from '@/types/performance'

function employee(partial: Partial<EmployeeGoalStatus>): EmployeeGoalStatus {
  return {
    owner: 'alice@co.com',
    ownerFullName: 'Alice Smith',
    employeeId: 'emp-1',
    reviewCycle: null,
    employeeGoalCount: 1,
    submitted: false,
    fullyApproved: false,
    hasPendingApproval: false,
    hasProgressUpdate: false,
    goals: [],
    ...partial,
  }
}

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
            reviewCycle: null,
            organisationUnit: 'Employee Kpi',
            organisationName: 'Product',
            approvalStatus: null,
            goalStatus: null,
            hasMetrics: false,
            hasProgressUpdate: false,
          },
        ],
      }),
      buildGoalOwnerProfileLookup([]),
    )
    expect(row.department).toBe('Product')
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
