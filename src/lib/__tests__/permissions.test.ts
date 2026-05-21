import { describe, expect, it } from 'vitest'
import { canAccessPath, canManageUsers, pageKeyFromPathname, roleHasPage } from '@/lib/permissions'

describe('permissions', () => {
  it('executive cannot access calibration', () => {
    expect(roleHasPage('executive', 'analytics.calibration')).toBe(false)
    expect(canAccessPath('executive', '/analytics/calibration')).toBe(false)
  })

  it('hr can access calibration but not user management', () => {
    expect(roleHasPage('hr', 'analytics.calibration')).toBe(true)
    expect(roleHasPage('hr', 'admin.access')).toBe(false)
  })

  it('only admin can manage users', () => {
    expect(canManageUsers('admin')).toBe(true)
    expect(canManageUsers('hr')).toBe(false)
  })

  it('manager can access people but not calibration', () => {
    expect(canAccessPath('manager', '/organization/people')).toBe(true)
    expect(canAccessPath('manager', '/analytics/calibration')).toBe(false)
  })

  it('maps person detail path', () => {
    expect(pageKeyFromPathname('/organization/people/abc-123')).toBe('organization.person')
  })

  it('admin has wildcard pages', () => {
    expect(roleHasPage('admin', 'admin.access')).toBe(true)
    expect(roleHasPage('admin', 'analytics.calibration')).toBe(true)
  })
})
