import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  ALL_DEPARTMENTS_SCOPE,
  getDepartmentScope,
  hasAllDepartmentsScope,
  normalizeScopedDepartments,
  filterEmployeesForUser,
} from './departmentScope.mjs'

describe('departmentScope', () => {
  it('normalizeScopedDepartments keeps * and named departments', () => {
    assert.deepEqual(normalizeScopedDepartments(['Trading', '*', 'HR']), ['*', 'HR', 'Trading'])
  })

  it('getDepartmentScope returns null when * is present', () => {
    const user = { role: 'hrbp', scopedDepartments: ['*', 'Trading'] }
    assert.equal(getDepartmentScope(user), null)
  })

  it('getDepartmentScope returns named departments without *', () => {
    const user = { role: 'hrbp', scopedDepartments: ['Trading', 'HR'] }
    assert.deepEqual(getDepartmentScope(user), ['HR', 'Trading'])
  })

  it('filterEmployeesForUser does not filter when * is present', () => {
    const employees = [
      { id: '1', department: 'Trading' },
      { id: '2', department: 'HR' },
    ]
    const user = { role: 'hrbp', scopedDepartments: ['*', 'Trading'] }
    assert.equal(filterEmployeesForUser(employees, user).length, 2)
  })

  it('hasAllDepartmentsScope detects sentinel', () => {
    assert.equal(hasAllDepartmentsScope([ALL_DEPARTMENTS_SCOPE]), true)
    assert.equal(hasAllDepartmentsScope(['Trading']), false)
  })
})
