import { routes } from '@/lib/routes'

export const TOUR_DISMISSED_KEY = 'pd-platform-tour-dismissed'

/** When false, the tour stays mounted but does not auto-start for new visitors. */
export const TOUR_AUTO_START_ENABLED = false

export type TourPlacement = 'center' | 'right' | 'bottom' | 'top'

export type TourStep = {
  id: string
  title: string
  body: string
  /** CSS selector; omit for centered welcome/finish steps */
  target?: string
  placement?: TourPlacement
  /** Page keys from permissions.json — step shown only if user can access at least one */
  requiresAnyPage?: string[]
  /** Route to open when this step starts (so sub-nav tabs are visible) */
  navigateTo?: string
}

export const PLATFORM_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    body: 'This dashboard shows performance reviews, goals, and analytics from Revolut People. This short tour highlights where to find things.',
    placement: 'center',
  },
  {
    id: 'home',
    title: 'Home',
    body: 'Start here for a snapshot: grades, scorecards, cycles, and quick links to common tasks.',
    target: '[data-tour="nav-home"]',
    placement: 'right',
    requiresAnyPage: ['home'],
  },
  {
    id: 'nav',
    title: 'Main menu',
    body: 'Use the left menu to move between sections. What you see depends on your role.',
    target: '[data-tour="sidebar-nav"]',
    placement: 'right',
  },
  {
    id: 'search',
    title: 'Find a page',
    body: 'Type here to filter menu items when you are not sure where something lives.',
    target: '[data-tour="sidebar-search"]',
    placement: 'right',
  },
  {
    id: 'organization',
    title: 'Organization',
    body: 'Departments shows team structure and grades. People lists the full Revolut employee directory — open someone for their review history.',
    target: '[data-tour="nav-organization"]',
    placement: 'right',
    requiresAnyPage: ['organization.departments', 'organization.people'],
  },
  {
    id: 'performance-menu',
    title: 'Open Performance',
    body: 'Click Performance in the left menu. This opens the review area — the actual pages are chosen from tabs at the top, not here.',
    target: '[data-tour="nav-performance"]',
    placement: 'right',
    requiresAnyPage: ['performance.records', 'performance.cycles'],
  },
  {
    id: 'performance-tabs',
    title: 'Performance pages',
    body: 'Use these tabs at the top after you open Performance. Records is the full list (and scorecards). Cycles shows status by review period.',
    target: '[data-tour="topbar-subnav"]',
    placement: 'bottom',
    navigateTo: routes.performance.records,
    requiresAnyPage: ['performance.records', 'performance.cycles'],
  },
  {
    id: 'goals',
    title: 'Goals',
    body: 'Browse imported goals or open Analytics for submission, approval, and check-in tracking.',
    target: '[data-tour="nav-goals"]',
    placement: 'right',
    requiresAnyPage: ['goals', 'goals.analytics'],
  },
  {
    id: 'performance-analytics',
    title: 'Performance analytics',
    body: 'Under Performance, Analytics shows rating distribution. Explore, Reviewers, and Calibration support review operations.',
    target: '[data-tour="nav-performance"]',
    placement: 'right',
    requiresAnyPage: [
      'performance.analytics',
      'performance.explore',
      'performance.reviewers',
      'performance.calibration',
    ],
  },
  {
    id: 'admin',
    title: 'Admin',
    body: 'Settings controls sync and display options. Data health flags gaps in imported records.',
    target: '[data-tour="nav-admin"]',
    placement: 'right',
    requiresAnyPage: ['admin.settings', 'admin.dataHealth'],
  },
  {
    id: 'content',
    title: 'Workspace',
    body: 'Tables, charts, and filters for the current page appear in this area.',
    target: '[data-tour="main-content"]',
    placement: 'top',
  },
  {
    id: 'profile',
    title: 'Your account',
    body: 'Open your profile from here. Use Sign out when you are done — the tour runs again next time you log in.',
    target: '[data-tour="sidebar-profile"]',
    placement: 'right',
    requiresAnyPage: ['account.profile'],
  },
  {
    id: 'finish',
    title: 'You are ready',
    body: 'Use Home quick links anytime. Skip tour on any step if you already know the layout.',
    placement: 'center',
  },
]

export type TourFilterContext = {
  canAccessPage: (pageKey: string) => boolean
}

export function filterTourSteps(
  steps: TourStep[],
  ctx: TourFilterContext,
): TourStep[] {
  return steps.filter((step) => {
    if (step.requiresAnyPage?.length) {
      return step.requiresAnyPage.some((key) => ctx.canAccessPage(key))
    }
    return true
  })
}

export function isTourDismissed(): boolean {
  try {
    return sessionStorage.getItem(TOUR_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

export function markTourDismissed(): void {
  try {
    sessionStorage.setItem(TOUR_DISMISSED_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function clearTourDismissed(): void {
  try {
    sessionStorage.removeItem(TOUR_DISMISSED_KEY)
  } catch {
    /* ignore */
  }
}
