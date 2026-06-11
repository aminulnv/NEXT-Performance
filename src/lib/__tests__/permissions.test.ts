import { describe, expect, it } from 'vitest'
import {
  canAccessEmployeesDirectory,
  canAccessPath,
  canAccessPerformanceData,
  canManageUsers,
  firstAccessiblePath,
  firstAccessiblePathInSection,
  pageKeyFromPathname,
  redirectPathForUnauthorized,
  roleHasPage,
} from '@/lib/permissions'

describe('permissions', () => {
  it('executive cannot access calibration', () => {
    expect(roleHasPage('executive', 'performance.calibration')).toBe(false)
    expect(canAccessPath('executive', '/performance/calibration')).toBe(false)
  })

  it('hr can access calibration but not user management', () => {
    expect(roleHasPage('hr', 'performance.calibration')).toBe(true)
    expect(roleHasPage('hr', 'admin.access')).toBe(false)
  })

  it('only admin can manage users', () => {
    expect(canManageUsers('admin')).toBe(true)
    expect(canManageUsers('hr')).toBe(false)
  })

  it('manager can access people but not calibration', () => {
    expect(canAccessPath('manager', '/organization/people')).toBe(true)
    expect(canAccessPath('manager', '/performance/calibration')).toBe(false)
  })

  it('maps person detail path', () => {
    expect(pageKeyFromPathname('/organization/people/abc-123')).toBe('organization.person')
  })

  it('admin has wildcard pages', () => {
    expect(roleHasPage('admin', 'admin.access')).toBe(true)
    expect(roleHasPage('admin', 'performance.calibration')).toBe(true)
  })

  it('hrbp can access goal analytics but not performance data', () => {
    expect(canAccessPath('hrbp', '/goals/analytics')).toBe(true)
    expect(canAccessPath('hrbp', '/performance/analytics')).toBe(false)
    expect(canAccessPerformanceData('hrbp')).toBe(false)
    expect(canAccessEmployeesDirectory('hrbp')).toBe(true)
    expect(firstAccessiblePath('hrbp')).toBe('/goals/analytics')
  })

  it('allows section root when role has any page in that section', () => {
    expect(canAccessPath('hr', '/performance')).toBe(true)
    expect(firstAccessiblePathInSection('hr', '/performance')).toBe('/performance/analytics')
    expect(canAccessPath('executive', '/performance')).toBe(true)
    expect(firstAccessiblePathInSection('executive', '/performance')).toBe('/performance/explore')
  })

  it('redirects to an allowed sibling page in the same section', () => {
    expect(redirectPathForUnauthorized('executive', '/performance/analytics')).toBe(
      '/performance/explore',
    )
    expect(redirectPathForUnauthorized('hrbp', '/performance/analytics')).toBe(
      '/goals/analytics',
    )
  })

  it('maps goals and performance analytics paths', () => {
    expect(pageKeyFromPathname('/goals/analytics')).toBe('goals.analytics')
    expect(pageKeyFromPathname('/performance/analytics')).toBe('performance.analytics')
  })
})
