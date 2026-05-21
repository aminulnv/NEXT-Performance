export const routes = {
  home: '/',
  organization: {
    root: '/organization',
    people: '/organization/people',
    person: (employeeId: string) => `/organization/people/${encodeURIComponent(employeeId)}`,
    departments: '/organization/departments',
  },
  performance: {
    root: '/performance',
    records: '/performance/records',
    cycles: '/performance/cycles',
    scorecard: (recordId: string) => `/performance/scorecards/${encodeURIComponent(recordId)}`,
  },
  goals: {
    root: '/goals',
  },
  analytics: {
    root: '/analytics',
    explore: '/analytics/explore',
    reviewers: '/analytics/reviewers',
    calibration: '/analytics/calibration',
    monitoring: '/analytics/monitoring',
  },
  admin: {
    root: '/admin',
    settings: '/admin/settings',
    dataHealth: '/admin/data-health',
    access: '/admin/access',
  },
  account: {
    profile: '/account/profile',
  },
} as const

/** Legacy paths kept for bookmarks and external links. */
export const legacyRoutes = {
  overview: '/',
  reviews: {
    root: '/reviews',
    cycles: '/reviews/cycles',
    scorecards: '/reviews/scorecards',
    reviewers: '/reviews/reviewers',
    calibration: '/reviews/calibration',
    goals: '/reviews/goals',
    goalsMonitoring: '/reviews/goals-monitoring',
    goalsMonitoringPath: '/goals/monitoring',
    ptrMonitoringPath: '/analytics/ptr-monitoring',
  },
  insights: {
    root: '/insights',
    metrics: '/insights/metrics',
  },
  adminProfile: '/admin/profile',
} as const
