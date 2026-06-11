import { describe, expect, it } from 'vitest'
import { Target, Activity } from 'lucide-react'
import { filterNavItems } from '@/lib/navFilter'
import type { NavItem } from '@/layout/types'
import { routes } from '@/lib/routes'

const goalsNav: NavItem = {
  path: routes.goals.root,
  label: 'Goals',
  icon: Target,
  children: [
    { path: routes.goals.analytics, label: 'Analytics', icon: Activity },
    { path: routes.goals.root, label: 'Browse', icon: Target },
  ],
}

describe('filterNavItems', () => {
  it('hides Goals Browse when role only has goals.analytics', () => {
    const canAccessPage = (pageKey: string) =>
      pageKey === 'goals.analytics' || pageKey === 'home'

    const filtered = filterNavItems([goalsNav], canAccessPage)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].children).toEqual([
      { path: routes.goals.analytics, label: 'Analytics', icon: Activity },
    ])
  })

  it('shows Goals Browse when role has goals page access', () => {
    const canAccessPage = (pageKey: string) =>
      pageKey === 'goals.analytics' || pageKey === 'goals'

    const filtered = filterNavItems([goalsNav], canAccessPage)
    expect(filtered[0].children).toHaveLength(2)
  })

  it('omits Goals section when role has no goals pages', () => {
    const filtered = filterNavItems([goalsNav], () => false)
    expect(filtered).toHaveLength(0)
  })
})
