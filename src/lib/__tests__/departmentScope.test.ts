import { describe, expect, it } from 'vitest'
import {
  ALL_DEPARTMENTS_SCOPE,
  departmentScopeLabel,
  hasAllDepartmentsScope,
  hasNamedDepartmentScope,
  isValidScopedDepartmentSelection,
  namedScopedDepartments,
  normalizeScopedDepartments,
} from '@/lib/departmentScope'

describe('departmentScope', () => {
  it('normalizeScopedDepartments puts * first and keeps named departments', () => {
    expect(normalizeScopedDepartments(['Trading', '*', 'People & Culture'])).toEqual([
      '*',
      'People & Culture',
      'Trading',
    ])
  })

  it('hasAllDepartmentsScope is true when * is present', () => {
    expect(hasAllDepartmentsScope(['*', 'Trading'])).toBe(true)
    expect(hasAllDepartmentsScope(['Trading'])).toBe(false)
  })

  it('hasNamedDepartmentScope is false when * is present', () => {
    expect(hasNamedDepartmentScope(['*', 'Trading'])).toBe(false)
    expect(hasNamedDepartmentScope(['Trading'])).toBe(true)
  })

  it('namedScopedDepartments excludes *', () => {
    expect(namedScopedDepartments(['*', 'Trading', 'People & Culture'])).toEqual([
      'People & Culture',
      'Trading',
    ])
  })

  it('departmentScopeLabel maps * to All departments', () => {
    expect(departmentScopeLabel(ALL_DEPARTMENTS_SCOPE)).toBe('All departments')
    expect(departmentScopeLabel('Trading')).toBe('Trading')
  })

  it('isValidScopedDepartmentSelection accepts * alone or with named departments', () => {
    expect(isValidScopedDepartmentSelection(['*'])).toBe(true)
    expect(isValidScopedDepartmentSelection(['*', 'Trading'])).toBe(true)
    expect(isValidScopedDepartmentSelection(['Trading'])).toBe(true)
    expect(isValidScopedDepartmentSelection([])).toBe(false)
  })
})
