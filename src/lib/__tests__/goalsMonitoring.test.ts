import { describe, expect, it } from 'vitest'
import {
  aggregateGoalsById,
  buildCheckInCompletionSummary,
  buildEmployeeGoalStatuses,
  buildGoalsMonitoringSummary,
  buildGradeComparison,
  buildManagersPendingApproval,
  uniqueReviewCycles,
} from '@/lib/goalsMonitoring'
import type { GoalRecord } from '@/types/goals'
import type { PerformanceRecord } from '@/types/performance'

function goal(partial: Partial<GoalRecord> & { fields?: Record<string, string> }): GoalRecord {
  return {
    id: partial.id ?? '1',
    employee_id: partial.employee_id ?? null,
    employee_name: partial.employee_name ?? null,
    owner: partial.owner ?? null,
    owner_full_name: partial.owner_full_name ?? null,
    cycle_name: partial.cycle_name ?? null,
    review_cycle: partial.review_cycle ?? partial.cycle_name ?? null,
    title: partial.title ?? null,
    status: partial.status ?? null,
    progress: partial.progress ?? null,
    goal_id: partial.goal_id ?? null,
    approval_status: partial.approval_status ?? null,
    organisation_unit: partial.organisation_unit ?? null,
    organisation_name: partial.organisation_name ?? null,
    current_value: partial.current_value ?? null,
    initial_value: partial.initial_value ?? null,
    fields: partial.fields ?? {},
  }
}

describe('buildGradeComparison', () => {
  it('computes gap vs PTR targets', () => {
    const rows = buildGradeComparison([
      { label: 'Performing', count: 43, pct: 43 },
      { label: 'Exceeding', count: 32, pct: 32 },
    ])
    const performing = rows.find((r) => r.label === 'Performing')
    expect(performing?.gap).toBe(-17)
    const exceeding = rows.find((r) => r.label === 'Exceeding')
    expect(exceeding?.gap).toBe(17)
  })
})

describe('buildCheckInCompletionSummary', () => {
  it('flags prior-quarter goals not marked complete by monitoring quarter Day 15', () => {
    const goals: GoalRecord[] = [
      goal({
        id: 'q1-open',
        goal_id: '100',
        owner: 'alice@co.com',
        title: 'Q1 goal',
        review_cycle: 'Q1 2026',
        organisation_unit: 'Employee Kpi',
        status: 'on_track',
      }),
      goal({
        id: 'q1-done',
        goal_id: '101',
        owner: 'bob@co.com',
        title: 'Q1 done',
        review_cycle: 'Q1 2026',
        organisation_unit: 'Employee Kpi',
        status: 'complete',
      }),
    ]

    const summary = buildCheckInCompletionSummary(goals, {
      monitoringQuarter: 2,
      monitoringYear: 2026,
      referenceDate: new Date('2026-04-10'),
    })

    expect(summary.priorQuarterLabel).toBe('Q1 2026')
    expect(summary.ownersWithPriorGoals).toBe(2)
    expect(summary.completionRatePct).toBe(50)
    expect(summary.needingCheckIn).toHaveLength(1)
    expect(summary.needingCheckIn[0].owner).toBe('alice@co.com')
    expect(summary.pastDay15).toBe(false)
    expect(summary.overdueAfterDay15).toHaveLength(0)
  })

  it('marks overdue after Day 15 of monitoring quarter', () => {
    const goals: GoalRecord[] = [
      goal({
        id: 'q1-open',
        goal_id: '100',
        owner: 'alice@co.com',
        title: 'Q1 goal',
        review_cycle: 'Q1 2026',
        organisation_unit: 'Employee Kpi',
        status: 'on_track',
      }),
    ]

    const summary = buildCheckInCompletionSummary(goals, {
      monitoringQuarter: 2,
      monitoringYear: 2026,
      referenceDate: new Date('2026-04-20'),
    })

    expect(summary.pastDay15).toBe(true)
    expect(summary.overdueAfterDay15).toHaveLength(1)
  })
})

describe('goalReviewCycle', () => {
  it('does not throw when fields is missing', () => {
    const goals: GoalRecord[] = [
      {
        id: 'minimal',
        employee_id: '1',
        employee_name: null,
        owner: null,
        owner_full_name: null,
        cycle_name: null,
        review_cycle: 'Q2 2026',
        title: 'Test',
        status: null,
        progress: null,
        goal_id: 'g1',
        approval_status: null,
        organisation_unit: 'Employee Kpi',
        organisation_name: null,
        current_value: null,
        initial_value: null,
        fields: undefined as unknown as Record<string, string>,
      },
    ]
    expect(() => buildGoalsMonitoringSummary(goals)).not.toThrow()
    expect(() => uniqueReviewCycles(goals)).not.toThrow()
  })
})

describe('buildGoalsMonitoringSummary', () => {
  it('computes submission and approval from employee KPI goals', () => {
    const goals: GoalRecord[] = [
      goal({
        id: 'a1',
        goal_id: '10',
        owner: 'alice@co.com',
        title: 'Goal A',
        organisation_unit: 'Employee Kpi',
        approval_status: 'approved',
        review_cycle: 'Q2 2026',
      }),
      goal({
        id: 'b1',
        goal_id: '20',
        owner: 'bob@co.com',
        title: 'Goal B',
        organisation_unit: 'Employee Kpi',
        approval_status: 'pending',
        review_cycle: 'Q2 2026',
      }),
      goal({
        id: 'c1',
        goal_id: '30',
        owner: 'carol@co.com',
        title: '',
        organisation_unit: 'Employee Kpi',
        approval_status: 'draft',
        review_cycle: 'Q2 2026',
      }),
    ]

    const summary = buildGoalsMonitoringSummary(goals, {
      cycleFilter: 'Q2 2026',
      calendarQuarter: 2,
      calendarYear: 2026,
      referenceDate: new Date('2026-04-20'),
    })
    expect(summary.totalOwners).toBe(3)
    expect(summary.submissionRatePct).toBe(67)
    expect(summary.approvalRatePct).toBe(33)
    expect(summary.notSubmitted).toHaveLength(1)
    expect(summary.submittedNotApproved).toHaveLength(1)
  })

  it('dedupes metrics under the same goal id', () => {
    const goals: GoalRecord[] = [
      goal({
        id: 'm1',
        goal_id: '99',
        owner: 'alice@co.com',
        title: 'OKR',
        organisation_unit: 'Employee Kpi',
        approval_status: 'approved',
        progress: '0',
        current_value: '5',
        initial_value: '0',
      }),
      goal({
        id: 'm2',
        goal_id: '99',
        owner: 'alice@co.com',
        title: 'OKR',
        organisation_unit: 'Employee Kpi',
        approval_status: 'approved',
        progress: '0.5',
        current_value: '50',
        initial_value: '0',
      }),
    ]

    const aggregated = aggregateGoalsById(goals)
    expect(aggregated).toHaveLength(1)
    expect(aggregated[0].hasProgressUpdate).toBe(true)

    const statuses = buildEmployeeGoalStatuses(goals)
    expect(statuses).toHaveLength(1)
    expect(statuses[0].hasProgressUpdate).toBe(true)
  })
})

describe('buildManagersPendingApproval', () => {
  it('groups pending goals by line manager from performance records', () => {
    const goals: GoalRecord[] = [
      goal({
        id: 'g1',
        goal_id: '10',
        owner: 'alice@co.com',
        employee_id: 'emp-a',
        title: 'Goal A',
        organisation_unit: 'Employee Kpi',
        approval_status: 'pending',
        review_cycle: 'Q2 2026',
      }),
      goal({
        id: 'g2',
        goal_id: '11',
        owner: 'alice@co.com',
        employee_id: 'emp-a',
        title: 'Goal B',
        organisation_unit: 'Employee Kpi',
        approval_status: 'pending',
        review_cycle: 'Q2 2026',
      }),
      goal({
        id: 'g3',
        goal_id: '20',
        owner: 'ben@co.com',
        employee_id: 'emp-b',
        title: 'Goal C',
        organisation_unit: 'Employee Kpi',
        approval_status: 'pending',
        review_cycle: 'Q2 2026',
      }),
    ]

    const records: PerformanceRecord[] = [
      {
        id: '1',
        sync_run_id: null,
        grade_record_id: null,
        employee_id: 'emp-a',
        cycle_id: null,
        employee_name: 'Alice',
        cycle_name: 'Q2 2026',
        department: 'Engineering',
        team: null,
        display_grade: null,
        line_manager_grade: null,
        calculated_grade: null,
        absolute_rating: null,
        ranking_score: null,
        payload: {
          'Employee Email': 'alice@co.com',
          'Line Manager (HR profile)': 'Manager One',
          'Line Manager (HR profile) Email': 'mgr1@co.com',
        },
        synced_at: '2026-01-01',
      },
      {
        id: '2',
        sync_run_id: null,
        grade_record_id: null,
        employee_id: 'emp-b',
        cycle_id: null,
        employee_name: 'Ben',
        cycle_name: 'Q2 2026',
        department: 'Product',
        team: null,
        display_grade: null,
        line_manager_grade: null,
        calculated_grade: null,
        absolute_rating: null,
        ranking_score: null,
        payload: {
          'Employee Email': 'ben@co.com',
          'Line Manager (HR profile)': 'Manager One',
          'Line Manager (HR profile) Email': 'mgr1@co.com',
        },
        synced_at: '2026-01-01',
      },
    ]

    const rows = buildManagersPendingApproval(goals, records, 'Q2 2026')
    expect(rows).toHaveLength(1)
    expect(rows[0].manager.name).toBe('Manager One')
    expect(rows[0].pendingGoalCount).toBe(3)
  })
})
