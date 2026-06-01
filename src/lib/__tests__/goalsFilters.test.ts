import { describe, expect, it } from 'vitest'
import { employeeGoalsUrl, personGoalsSearchUrl, readGoalsFilters } from '@/lib/goalsFilters'

describe('employeeGoalsUrl', () => {
  it('builds goals URL with employee id', () => {
    expect(employeeGoalsUrl({ employeeId: 'emp-1' })).toBe('/goals?employee=emp-1')
  })

  it('falls back to owner when no employee id', () => {
    expect(employeeGoalsUrl({ owner: 'alice@co.com' })).toBe('/goals?owner=alice%40co.com')
  })

  it('prefers employee id over owner', () => {
    expect(employeeGoalsUrl({ employeeId: 'emp-1', owner: 'alice@co.com' })).toBe(
      '/goals?employee=emp-1',
    )
  })

  it('returns null when neither is set', () => {
    expect(employeeGoalsUrl({})).toBeNull()
  })
})

describe('personGoalsSearchUrl', () => {
  it('builds goals URL with search query', () => {
    expect(personGoalsSearchUrl('SM Fahim')).toBe('/goals?search=SM+Fahim')
  })

  it('returns null for empty name', () => {
    expect(personGoalsSearchUrl('  ')).toBeNull()
  })
})

describe('readGoalsFilters', () => {
  it('reads employee and owner from search params', () => {
    const params = new URLSearchParams('employee=emp-1&owner=alice@co.com')
    expect(readGoalsFilters(params)).toEqual({ employee: 'emp-1', owner: 'alice@co.com' })
  })

  it('reads search from search params', () => {
    const params = new URLSearchParams('search=SM+Fahim')
    expect(readGoalsFilters(params)).toEqual({ search: 'SM Fahim' })
  })
})
