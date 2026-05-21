import { describe, expect, it } from 'vitest'
import { filterTourSteps, PLATFORM_TOUR_STEPS } from '@/lib/platformTour'
import { routes } from '@/lib/routes'

describe('filterTourSteps', () => {
  const noPages = () => false

  it('includes welcome and finish for any user', () => {
    const steps = filterTourSteps(PLATFORM_TOUR_STEPS, {
      canAccessPage: noPages,
    })
    expect(steps.some((s) => s.id === 'welcome')).toBe(true)
    expect(steps.some((s) => s.id === 'finish')).toBe(true)
  })

  it('includes performance tab guidance when user has performance access', () => {
    const steps = filterTourSteps(PLATFORM_TOUR_STEPS, {
      canAccessPage: (key) =>
        key === 'performance.records' || key === 'performance.cycles',
    })
    expect(steps.some((s) => s.id === 'performance-menu')).toBe(true)
    expect(steps.some((s) => s.id === 'performance-tabs')).toBe(true)
    expect(steps.find((s) => s.id === 'performance-tabs')?.navigateTo).toBe(
      routes.performance.records,
    )
  })

  it('hides performance steps when role has no performance pages', () => {
    const steps = filterTourSteps(PLATFORM_TOUR_STEPS, {
      canAccessPage: (key) => key === 'home',
    })
    expect(steps.some((s) => s.id === 'performance-menu')).toBe(false)
    expect(steps.some((s) => s.id === 'performance-tabs')).toBe(false)
    expect(steps.some((s) => s.id === 'home')).toBe(true)
  })

  it('does not include user management step', () => {
    const steps = filterTourSteps(PLATFORM_TOUR_STEPS, {
      canAccessPage: () => true,
    })
    expect(steps.some((s) => s.id === 'users')).toBe(false)
  })
})
