import { routes } from '@/lib/routes'

/** Maps nav paths to `data-tour` attribute values for the platform tour. */
export function navTourId(path: string): string | undefined {
  if (path === routes.home) return 'nav-home'
  if (path === routes.organization.root) return 'nav-organization'
  if (path === routes.performance.root) return 'nav-performance'
  if (path === routes.goals.root) return 'nav-goals'
  if (path === routes.analytics.root) return 'nav-analytics'
  if (path === routes.admin.root) return 'nav-admin'
  return undefined
}
