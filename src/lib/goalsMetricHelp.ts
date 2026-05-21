/** Short explanations for program monitoring goal metrics. */
export const GOALS_METRIC_HELP = {
  submissionRate:
    '% of people with individual employee goals who submitted (not draft, has a title).',
  approvalRate:
    '% of people whose submitted goals are all manager-approved.',
  progressUpdateRate:
    '% of people with a submitted goal that has progress or updated actuals.',
  checkInCompletionRate:
    '% of people with prior-quarter employee goals marked complete in Revolut (Goal Status = Complete) by Day 15 of the selected quarter.',
} as const
