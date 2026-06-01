/** Short explanations for program monitoring goal metrics. */
export const GOALS_METRIC_HELP = {
  totalEmployees:
    'Active employees from Organization → People (Revolut directory), matched to goals by employee ID or email. From Q2 2026 onward, only people who joined on or before the quarter start date are counted (e.g. joined by 1 Apr for Q2).',
  submissionRate:
    '% of active employees who submitted employee KPI goals (not draft, has a title).',
  pendingSubmission:
    'People who have not started or submitted employee goals (draft or empty title).',
  awaitingApproval:
    'People who submitted goals but at least one goal is still pending manager approval.',
  approvedLocked:
    'People whose submitted employee goals are all manager-approved (locked).',
  overdueDay30:
    'People who submitted goals but are not fully approved after Day 30 of the selected quarter.',
  approvalRate:
    '% of people whose submitted goals are all manager-approved.',
  progressUpdateRate:
    '% of people with a submitted goal that has progress or updated actuals.',
  checkInCompletionRate:
    '% of people with prior-quarter employee goals marked complete in Revolut (Goal Status = Complete) by Day 15 of the selected quarter.',
  managerApprovalCompliance:
    '% of managers with at least one submitted direct report whose entire submitted team is fully approved.',
  avgApprovalTime:
    'Average days from goal submission to manager approval (requires Submitted Date and Approval Date columns in the export).',
  wrongGoalCount:
    'Submitted employees with fewer than 3 or more than 5 employee goals.',
  day10NotSubmitted:
    'Employees with zero submitted goals on or after Day 10 of the selected quarter.',
  lowSubmissionDepartments:
    'Departments with at least 3 employees in scope and below 60% goal submission rate.',
} as const
