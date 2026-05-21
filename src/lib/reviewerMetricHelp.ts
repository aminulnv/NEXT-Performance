/** Short explanations shown next to Reviewers page metrics. */
export const REVIEWER_METRIC_HELP = {
  reviewsWithTiming:
    'Scorecards in the current filter that have both Opened and Completed timestamps from Revolut.',
  reviewers:
    'Distinct people who completed at least one timed scorecard in the current filter.',
  medianReviewTime:
    'Sort every review duration (completed minus opened) shortest to longest, then take the middle value. Half of reviews took longer; half took less. Unlike the average, one very slow review does not pull this up as much.',
  averageReviewTime:
    'Add up all review durations in the filter and divide by how many reviews had timing. One or two very long reviews increase this more than the median.',
  reviews:
    'How many scorecards this reviewer completed with both opened and completed timestamps.',
  medianTime:
    'Same as median review time, but calculated only from this reviewer’s reviews (middle value when their durations are sorted).',
  averageTime:
    'Same as average review time, but only for this reviewer (sum of their review durations ÷ count).',
  reviewTime:
    'Completed datetime minus opened datetime for this scorecard (how long that single review took).',
  opened:
    'Scorecard Opened Date Time — when the reviewer opened the scorecard in Revolut.',
  completed:
    'Scorecard Completed Date Time — when the reviewer submitted the scorecard.',
  status: 'Scorecard status from Revolut (e.g. completed, completed_late).',
  reviewer:
    'Person who wrote the scorecard (from Scorecard Reviewer; usually the line manager).',
  employee: 'Employee being reviewed on this scorecard.',
  department: 'Department of the employee being reviewed.',
  cycle: 'Performance review cycle this scorecard belongs to.',
} as const
