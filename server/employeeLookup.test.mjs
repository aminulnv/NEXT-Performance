import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildEmployeesByEmailFromList,
  buildEmployeesByEmailFromRecords,
  lookupEmployeeByEmail,
  mergeRevolutEmployeesDirectory,
  registerEmployeeCacheAccessor,
  resolveEmployeeMatchFromIndex,
} from './employeeLookup.mjs'

describe('employeeLookup', () => {
  it('indexes employees by email', () => {
    const index = buildEmployeesByEmailFromList([
      { id: 304, email: 'manager@nextventures.io', first_name: 'Sam', last_name: 'Lee' },
    ])
    assert.equal(index['manager@nextventures.io'].id, '304')
    assert.equal(index['manager@nextventures.io'].name, 'Sam Lee')
  })

  it('falls back to performance records', () => {
    const index = buildEmployeesByEmailFromRecords([
      {
        employee_id: '99',
        employee_name: 'Alex',
        payload: { 'Employee Email': 'alex@nextventures.io', 'Employee ID': '99' },
      },
    ])
    assert.equal(index['alex@nextventures.io'].id, '99')
  })

  it('lookupEmployeeByEmail uses registered cache', () => {
    registerEmployeeCacheAccessor(() => ({
      employeesByEmail: {
        'hr@nextventures.io': { id: '12', name: 'HR User' },
      },
      records: [],
    }))
    const match = lookupEmployeeByEmail('hr@nextventures.io')
    assert.equal(match?.id, '12')
    assert.equal(match?.source, 'revolut_directory')
  })

  it('resolveEmployeeMatchFromIndex works without memory cache', () => {
    registerEmployeeCacheAccessor(() => null)
    mergeRevolutEmployeesDirectory({
      'lam@nextventures.io': { id: '501', name: 'Chris Lam' },
    })
    const match = resolveEmployeeMatchFromIndex('lam@nextventures.io')
    assert.equal(match?.id, '501')
    assert.equal(match?.name, 'Chris Lam')
    assert.equal(lookupEmployeeByEmail('lam@nextventures.io')?.id, '501')
  })
})
