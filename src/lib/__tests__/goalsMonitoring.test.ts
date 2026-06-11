import { describe, expect, it } from 'vitest'
import {
  aggregateGoalsById,
  buildCheckInCompletionSummary,
  buildEmployeeGoalStatuses,
  buildGoalsMonitoringSummary,
  buildGradeComparison,
  buildManagerComplianceMetrics,
  buildManagersPendingApproval,
  buildSubmissionBreakdownByKey,
  uniqueReviewCycles,
} from '@/lib/goalsMonitoring'
import type { EmployeeDirectoryEntry } from '@/types/employee'
import type { GoalRecord } from '@/types/goals'
import type { PerformanceRecord } from '@/types/performance'

function roster(
  partial: Partial<EmployeeDirectoryEntry> & Pick<EmployeeDirectoryEntry, 'id' | 'email'>,
): EmployeeDirectoryEntry {
  return {
    remoteId: null,
    name: partial.name ?? partial.email ?? partial.id,
    fullName: null,
    firstName: null,
    middleName: null,
    lastName: null,
    department: partial.department ?? null,
    avatar: null,
    team: null,
    location: null,
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
    ...partial,
  }
}

const q2Roster: EmployeeDirectoryEntry[] = [
  roster({
    id: 'emp-a',
    email: 'alice@co.com',
    name: 'Alice',
    joiningDateTime: '2025-01-01',
  }),
  roster({
    id: 'emp-b',
    email: 'bob@co.com',
    name: 'Bob',
    joiningDateTime: '2025-06-01',
  }),
  roster({
    id: 'emp-c',
    email: 'carol@co.com',
    name: 'Carol',
    joiningDateTime: '2026-03-15',
  }),
]

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
    submitted_at: partial.submitted_at ?? null,
    approved_at: partial.approved_at ?? null,
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
        submitted_at: null,
        approved_at: null,
        fields: undefined as unknown as Record<string, string>,
      },
    ]
    expect(() => buildGoalsMonitoringSummary(goals)).not.toThrow()
    expect(() => uniqueReviewCycles(goals)).not.toThrow()
  })

  it('reads review cycle from fields when normalized columns are empty', () => {
    const goals: GoalRecord[] = [
      {
        id: 'from-fields',
        employee_id: '1',
        employee_name: null,
        owner: 'alice@co.com',
        owner_full_name: null,
        cycle_name: null,
        review_cycle: null,
        title: 'Test',
        status: null,
        progress: null,
        goal_id: 'g1',
        approval_status: null,
        organisation_unit: 'Employee Kpi',
        organisation_name: null,
        current_value: null,
        initial_value: null,
        submitted_at: null,
        approved_at: null,
        fields: { 'Review Cycle': 'Q2 Cycle' },
      },
    ]
    expect(uniqueReviewCycles(goals)).toEqual(['Q2 Cycle'])
  })

  it('matches performance half-year labels to quarterly goal cycles', () => {
    const goals: GoalRecord[] = [
      goal({
        id: 'a1',
        goal_id: '10',
        owner: 'alice@co.com',
        employee_id: 'emp-a',
        title: 'Goal A',
        organisation_unit: 'Employee Kpi',
        approval_status: 'approved',
        review_cycle: 'Q1 2026',
      }),
    ]

    const summary = buildGoalsMonitoringSummary(goals, {
      cycleFilter: '2026 H1',
    })

    expect(summary.submissionCounts.submitted.count).toBe(1)
  })
})

describe('buildGoalsMonitoringSummary', () => {
  it('computes submission and approval from employee KPI goals', () => {
    const goals: GoalRecord[] = [
      goal({
        id: 'a1',
        goal_id: '10',
        owner: 'alice@co.com',
        employee_id: 'emp-a',
        title: 'Goal A',
        organisation_unit: 'Employee Kpi',
        approval_status: 'approved',
        review_cycle: 'Q2 2026',
      }),
      goal({
        id: 'b1',
        goal_id: '20',
        owner: 'bob@co.com',
        employee_id: 'emp-b',
        title: 'Goal B',
        organisation_unit: 'Employee Kpi',
        approval_status: 'pending',
        review_cycle: 'Q2 2026',
      }),
      goal({
        id: 'c1',
        goal_id: '30',
        owner: 'carol@co.com',
        employee_id: 'emp-c',
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
      activeRoster: q2Roster,
    })
    expect(summary.totalOwners).toBe(3)
    expect(summary.submissionRatePct).toBe(67)
    expect(summary.approvalRatePct).toBe(33)
    expect(summary.submissionCounts.submitted.count).toBe(2)
    expect(summary.submissionCounts.submitted.goalCount).toBe(2)
    expect(summary.submissionCounts.pendingSubmission.count).toBe(1)
    expect(summary.submissionCounts.awaitingApproval.count).toBe(1)
    expect(summary.submissionCounts.approvedLocked.count).toBe(1)
    expect(summary.submitted).toHaveLength(2)
    expect(summary.notSubmitted).toHaveLength(1)
    expect(summary.awaitingApproval).toHaveLength(1)
    expect(summary.approvedLocked).toHaveLength(1)
    expect(summary.submittedNotApproved).toHaveLength(1)
  })

  it('matches performance review cycle labels to quarter-only goal cycles', () => {
    const goals: GoalRecord[] = [
      goal({
        id: 'a1',
        goal_id: '10',
        owner: 'alice@co.com',
        employee_id: 'emp-a',
        title: 'Goal A',
        organisation_unit: 'Employee Kpi',
        approval_status: 'approved',
        review_cycle: 'Q2 Cycle',
      }),
    ]

    const summary = buildGoalsMonitoringSummary(goals, {
      cycleFilter: 'Q2 2026',
      calendarQuarter: 2,
      calendarYear: 2026,
      activeRoster: q2Roster,
    })

    expect(summary.submissionCounts.submitted.count).toBe(1)
  })

  it('flags overdue approvals after Day 30 of the quarter', () => {
    const goals: GoalRecord[] = [
      goal({
        id: 'b1',
        goal_id: '20',
        owner: 'bob@co.com',
        employee_id: 'emp-b',
        title: 'Goal B',
        organisation_unit: 'Employee Kpi',
        approval_status: 'pending',
        review_cycle: 'Q2 2026',
      }),
    ]

    const summary = buildGoalsMonitoringSummary(goals, {
      cycleFilter: 'Q2 2026',
      calendarQuarter: 2,
      calendarYear: 2026,
      referenceDate: new Date('2026-05-30'),
      activeRoster: [
        roster({
          id: 'emp-b',
          email: 'bob@co.com',
          name: 'Bob',
          joiningDateTime: '2025-06-01',
        }),
      ],
    })

    expect(summary.overdueDay30NotApproved).toHaveLength(1)
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

  it('merges goal metadata from later metric rows', () => {
    const goals: GoalRecord[] = [
      goal({
        id: 'metric-only',
        goal_id: '165',
        employee_name: 'SM Fahim',
        title: 'Testing',
        status: 'On Track',
        fields: { 'Metric name': 'MMR', 'Metric ID': '165' },
      }),
      goal({
        id: 'goal-meta',
        goal_id: '165',
        employee_id: 'emp-fahim',
        employee_name: 'SM Fahim',
        title: 'Testing',
        review_cycle: 'LT 2025 Performance Eval',
        organisation_unit: 'Employee Kpi',
        approval_status: 'approved',
        status: 'On Track',
      }),
    ]

    const aggregated = aggregateGoalsById(goals)
    expect(aggregated).toHaveLength(1)
    expect(aggregated[0].reviewCycle).toBe('LT 2025 Performance Eval')
    expect(aggregated[0].organisationUnit).toBe('Employee Kpi')

    const summary = buildGoalsMonitoringSummary(goals, {
      cycleFilter: 'LT 2025 Performance Eval',
      activeRoster: [
        roster({
          id: 'emp-fahim',
          email: 'fahim@co.com',
          name: 'SM Fahim',
        }),
      ],
    })

    expect(summary.submissionCounts.submitted.count).toBe(1)
  })

  it('links name-only goals export rows to the People directory roster', () => {
    const goals: GoalRecord[] = [
      goal({
        id: 'row-1',
        employee_name: 'SM Fahim',
        title: 'Testing',
        review_cycle: 'LT 2025 Performance Eval',
        status: 'On Track',
        fields: { 'Metric name': 'MMR', 'Metric ID': '165' },
      }),
    ]

    const summary = buildGoalsMonitoringSummary(goals, {
      cycleFilter: 'LT 2025 Performance Eval',
      calendarQuarter: 2,
      calendarYear: 2026,
      activeRoster: [
        roster({
          id: 'emp-fahim',
          email: 'fahim@next.com',
          name: 'SM Fahim',
          joiningDateTime: '2025-01-01',
        }),
      ],
    })

    expect(summary.submissionCounts.submitted.count).toBe(1)
    expect(summary.submissionCounts.pendingSubmission.count).toBe(0)
  })

  it('counts export-only goal owners who are not in the People directory', () => {
    const goals: GoalRecord[] = [
      goal({
        id: 'row-1',
        employee_name: 'SM Fahim',
        title: 'Testing',
        review_cycle: 'LT 2025 Performance Eval',
        status: 'On Track',
        approval_status: 'approved',
        fields: { 'Metric name': 'MMR', 'Metric ID': '165' },
      }),
    ]

    const summary = buildGoalsMonitoringSummary(goals, {
      cycleFilter: 'LT 2025 Performance Eval',
      activeRoster: [
        roster({
          id: 'emp-other',
          email: 'other@next.com',
          name: 'Someone Else',
        }),
      ],
    })

    expect(summary.totalOwners).toBe(1)
    expect(summary.submissionCounts.submitted.count).toBe(0)
    expect(summary.submitted).toHaveLength(0)
    expect(summary.notSubmitted).toHaveLength(1)
    expect(summary.notSubmitted[0].ownerFullName).toBe('Someone Else')
  })

  it('counts goals with non-standard organisation unit labels', () => {
    const goals: GoalRecord[] = [
      goal({
        id: 'row-1',
        employee_name: 'SM Fahim',
        title: 'Testing',
        review_cycle: 'LT 2025 Performance Eval',
        organisation_unit: 'Individual KPI',
        approval_status: 'approved',
      }),
    ]

    const summary = buildGoalsMonitoringSummary(goals, {
      cycleFilter: 'LT 2025 Performance Eval',
      activeRoster: [
        roster({
          id: 'emp-fahim',
          email: 'fahim@next.com',
          name: 'SM Fahim',
        }),
      ],
    })

    expect(summary.submissionCounts.submitted.count).toBe(1)
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

describe('buildManagerComplianceMetrics', () => {
  it('computes manager approval compliance and avg approval time', () => {
    const goals: GoalRecord[] = [
      goal({
        id: 'g1',
        goal_id: '10',
        owner: 'alice@co.com',
        employee_id: 'emp-a',
        title: 'Goal A',
        organisation_unit: 'Employee Kpi',
        approval_status: 'approved',
        review_cycle: 'Q2 2026',
        submitted_at: '2026-04-01',
        approved_at: '2026-04-06',
      }),
      goal({
        id: 'g2',
        goal_id: '11',
        owner: 'ben@co.com',
        employee_id: 'emp-b',
        title: 'Goal B',
        organisation_unit: 'Employee Kpi',
        approval_status: 'pending',
        review_cycle: 'Q2 2026',
        submitted_at: '2026-04-01',
      }),
      goal({
        id: 'g3',
        goal_id: '12',
        owner: 'carol@co.com',
        employee_id: 'emp-c',
        title: '',
        organisation_unit: 'Employee Kpi',
        approval_status: 'draft',
        review_cycle: 'Q2 2026',
      }),
    ]

    const complianceRoster: EmployeeDirectoryEntry[] = [
      roster({
        id: 'emp-a',
        email: 'alice@co.com',
        joiningDateTime: '2025-01-01',
        lineManagerEmail: 'mgr1@co.com',
        lineManagerName: 'Manager One',
      }),
      roster({
        id: 'emp-b',
        email: 'ben@co.com',
        joiningDateTime: '2025-01-01',
        lineManagerEmail: 'mgr1@co.com',
        lineManagerName: 'Manager One',
      }),
      roster({
        id: 'emp-c',
        email: 'carol@co.com',
        joiningDateTime: '2025-01-01',
        lineManagerEmail: 'mgr2@co.com',
        lineManagerName: 'Manager Two',
      }),
    ]

    const employees = buildEmployeeGoalStatuses(goals, 'Q2 2026', complianceRoster)
    const compliance = buildManagerComplianceMetrics(
      goals,
      employees,
      'Q2 2026',
      new Date('2026-04-10'),
    )

    expect(compliance.managersWithSubmittedTeam).toBe(1)
    expect(compliance.managersAllTeamApprovedCount).toBe(0)
    expect(compliance.managersAllTeamApprovedPct).toBe(0)
    expect(compliance.avgDaysSubmissionToApproval).toBe(5)
    expect(compliance.managersZeroTeamSubmitted).toHaveLength(1)
    expect(compliance.managersZeroTeamSubmitted[0].manager.name).toBe('Manager Two')
    expect(compliance.managersPendingOver5Days).toHaveLength(1)
  })
})

describe('buildSubmissionBreakdown', () => {
  it('groups submission metrics by department', () => {
    const goals: GoalRecord[] = [
      goal({
        id: 'a1',
        goal_id: '10',
        owner: 'alice@co.com',
        employee_id: 'emp-a',
        title: 'Goal A',
        organisation_unit: 'Employee Kpi',
        approval_status: 'approved',
        review_cycle: 'Q2 2026',
      }),
      goal({
        id: 'b1',
        goal_id: '20',
        owner: 'ben@co.com',
        employee_id: 'emp-b',
        title: '',
        organisation_unit: 'Employee Kpi',
        approval_status: 'draft',
        review_cycle: 'Q2 2026',
      }),
    ]

    const deptRoster: EmployeeDirectoryEntry[] = [
      roster({
        id: 'emp-a',
        email: 'alice@co.com',
        department: 'Engineering',
        joiningDateTime: '2025-01-01',
      }),
      roster({
        id: 'emp-b',
        email: 'ben@co.com',
        department: 'Engineering',
        joiningDateTime: '2025-01-01',
      }),
    ]

    const employees = buildEmployeeGoalStatuses(goals, 'Q2 2026', deptRoster)
    const byDept = buildSubmissionBreakdownByKey(
      employees,
      (employee) => employee.department ?? 'Unknown',
    )

    expect(byDept).toHaveLength(1)
    expect(byDept[0].label).toBe('Engineering')
    expect(byDept[0].submittedPct).toBe(50)
  })

  it('flags wrong goal counts and low submission departments', () => {
    const goals: GoalRecord[] = [
      goal({
        id: 'a1',
        goal_id: '10',
        owner: 'alice@co.com',
        employee_id: 'emp-a',
        title: 'Goal A',
        organisation_unit: 'Employee Kpi',
        approval_status: 'approved',
        review_cycle: 'Q2 2026',
      }),
      goal({
        id: 'a2',
        goal_id: '11',
        owner: 'ben@co.com',
        employee_id: 'emp-b',
        title: 'Goal B',
        organisation_unit: 'Employee Kpi',
        approval_status: 'approved',
        review_cycle: 'Q2 2026',
      }),
      goal({
        id: 'c1',
        goal_id: '30',
        owner: 'carol@co.com',
        employee_id: 'emp-c',
        title: '',
        organisation_unit: 'Employee Kpi',
        approval_status: 'draft',
        review_cycle: 'Q2 2026',
      }),
      goal({
        id: 'c2',
        goal_id: '31',
        owner: 'dave@co.com',
        employee_id: 'emp-d',
        title: '',
        organisation_unit: 'Employee Kpi',
        approval_status: 'draft',
        review_cycle: 'Q2 2026',
      }),
    ]

    const opsRoster: EmployeeDirectoryEntry[] = [
      roster({ id: 'emp-a', email: 'alice@co.com', department: 'Ops', joiningDateTime: '2025-01-01' }),
      roster({ id: 'emp-b', email: 'ben@co.com', department: 'Ops', joiningDateTime: '2025-01-01' }),
      roster({ id: 'emp-c', email: 'carol@co.com', department: 'Ops', joiningDateTime: '2025-01-01' }),
      roster({ id: 'emp-d', email: 'dave@co.com', department: 'Ops', joiningDateTime: '2025-01-01' }),
    ]

    const summary = buildGoalsMonitoringSummary(goals, {
      cycleFilter: 'Q2 2026',
      calendarQuarter: 2,
      calendarYear: 2026,
      referenceDate: new Date('2026-04-12'),
      activeRoster: opsRoster,
    })

    expect(summary.qualityWrongGoalCount.map((e) => e.owner)).toEqual(
      expect.arrayContaining(['alice@co.com', 'ben@co.com']),
    )
    expect(summary.lowSubmissionDepartments).toHaveLength(1)
    expect(summary.lowSubmissionDepartments[0].submissionPct).toBe(50)
    expect(summary.flagDay10NotSubmitted).toHaveLength(2)
  })

  it('uses active roster headcount when extra employees have no goals', () => {
    const goals: GoalRecord[] = [
      goal({
        id: 'a1',
        goal_id: '10',
        owner: 'alice@co.com',
        employee_id: 'emp-a',
        title: 'Goal A',
        organisation_unit: 'Employee Kpi',
        approval_status: 'approved',
        review_cycle: 'Q2 2026',
      }),
    ]

    const summary = buildGoalsMonitoringSummary(goals, {
      cycleFilter: 'Q2 2026',
      activeRoster: [
        roster({ id: 'emp-a', email: 'alice@co.com', joiningDateTime: '2025-01-01' }),
        roster({
          id: 'emp-x',
          email: 'extra@co.com',
          name: 'Extra',
          joiningDateTime: '2025-01-01',
        }),
      ],
    })

    expect(summary.totalOwners).toBe(2)
    expect(summary.submissionRatePct).toBe(50)
    expect(summary.notSubmitted).toHaveLength(1)
    expect(summary.notSubmitted[0].owner).toBe('extra@co.com')
  })

  it('excludes employees who joined after the quarter start from Q2 2026 metrics', () => {
    const goals: GoalRecord[] = [
      goal({
        id: 'a1',
        goal_id: '10',
        owner: 'alice@co.com',
        employee_id: 'emp-a',
        title: 'Goal A',
        organisation_unit: 'Employee Kpi',
        approval_status: 'approved',
        review_cycle: 'Q2 2026',
      }),
      goal({
        id: 'n1',
        goal_id: '11',
        owner: 'new@co.com',
        employee_id: 'emp-new',
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
      activeRoster: [
        roster({
          id: 'emp-a',
          email: 'alice@co.com',
          joiningDateTime: '2026-04-01',
        }),
        roster({
          id: 'emp-new',
          email: 'new@co.com',
          joiningDateTime: '2026-04-02',
        }),
      ],
    })

    expect(summary.totalOwners).toBe(1)
    expect(summary.submissionRatePct).toBe(100)
  })

  it('does not apply joining cutoff to Q1 2026 metrics', () => {
    const goals: GoalRecord[] = [
      goal({
        id: 'n1',
        goal_id: '11',
        owner: 'new@co.com',
        employee_id: 'emp-new',
        title: '',
        organisation_unit: 'Employee Kpi',
        approval_status: 'draft',
        review_cycle: 'Q1 2026',
      }),
    ]

    const summary = buildGoalsMonitoringSummary(goals, {
      cycleFilter: 'Q1 2026',
      calendarQuarter: 1,
      calendarYear: 2026,
      activeRoster: [
        roster({
          id: 'emp-new',
          email: 'new@co.com',
          joiningDateTime: '2026-04-02',
        }),
      ],
    })

    expect(summary.totalOwners).toBe(1)
  })

  it('scopes submission metrics to the active roster when country-filtered', () => {
    const goals: GoalRecord[] = [
      goal({
        id: 'a1',
        goal_id: '10',
        owner: 'alice@co.com',
        employee_id: 'emp-a',
        title: 'Goal A',
        organisation_unit: 'Employee Kpi',
        approval_status: 'approved',
        review_cycle: 'Q2 2026',
      }),
      goal({
        id: 'b1',
        goal_id: '11',
        owner: 'bob@co.com',
        employee_id: 'emp-b',
        title: 'Goal B',
        organisation_unit: 'Employee Kpi',
        approval_status: 'pending',
        review_cycle: 'Q2 2026',
      }),
    ]

    const summary = buildGoalsMonitoringSummary(goals, {
      cycleFilter: 'Q2 2026',
      calendarQuarter: 2,
      calendarYear: 2026,
      activeRoster: [
        roster({
          id: 'emp-a',
          email: 'alice@co.com',
          location: 'Malaysia Office',
          joiningDateTime: '2025-01-01',
        }),
      ],
    })

    expect(summary.totalOwners).toBe(1)
    expect(summary.submissionCounts.submitted.count).toBe(1)
    expect(summary.submissionCounts.submitted.pct).toBe(100)
    expect(summary.submissionCounts.pendingSubmission.count).toBe(0)
    expect(summary.submissionCounts.awaitingApproval.count).toBe(0)
    expect(summary.submitted).toHaveLength(1)
    expect(summary.submitted[0].employeeId).toBe('emp-a')
  })

  it('normalizes location breakdown to full country names', () => {
    const goals: GoalRecord[] = [
      goal({
        id: 'a1',
        goal_id: '10',
        owner: 'alice@co.com',
        employee_id: 'emp-a',
        title: 'Goal A',
        organisation_unit: 'Employee Kpi',
        approval_status: 'approved',
        review_cycle: 'Q2 2026',
      }),
      goal({
        id: 'b1',
        goal_id: '11',
        owner: 'bob@co.com',
        employee_id: 'emp-b',
        title: 'Goal B',
        organisation_unit: 'Employee Kpi',
        approval_status: 'approved',
        review_cycle: 'Q2 2026',
      }),
    ]

    const summary = buildGoalsMonitoringSummary(goals, {
      cycleFilter: 'Q2 2026',
      calendarQuarter: 2,
      calendarYear: 2026,
      activeRoster: [
        roster({
          id: 'emp-a',
          email: 'alice@co.com',
          location: 'Malaysia Office',
          joiningDateTime: '2025-01-01',
        }),
        roster({
          id: 'emp-b',
          email: 'bob@co.com',
          location: 'Sri Lanka',
          joiningDateTime: '2025-01-01',
        }),
      ],
    })

    const labels = summary.breakdownByLocation.map((row) => row.label).sort()
    expect(labels).toEqual(['Malaysia', 'Sri Lanka'])
  })
})
