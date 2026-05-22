import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeEmployeeForDirectory, normalizeEmployeesList } from './employeeDirectory.mjs'

describe('employeeDirectory', () => {
  it('normalizes Revolut employee profile fields', () => {
    const row = normalizeEmployeeForDirectory({
      id: 'emp-1',
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'Ada@Example.com',
      status: 'active',
      team: {
        name: 'Platform',
        department: { name: 'Engineering' },
      },
      line_manager: {
        id: 'mgr-1',
        first_name: 'Grace',
        last_name: 'Hopper',
        email: 'grace@example.com',
      },
    })

    assert.deepEqual(row, {
      id: 'emp-1',
      remoteId: null,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      department: 'Engineering',
      team: 'Platform',
      status: 'active',
      lineManagerId: 'mgr-1',
      lineManagerName: 'Grace Hopper',
      lineManagerEmail: 'grace@example.com',
    })
  })

  it('deduplicates and sorts employees by name', () => {
    const rows = normalizeEmployeesList([
      { id: '2', first_name: 'Zed', last_name: 'Alpha' },
      { id: '1', first_name: 'Amy', last_name: 'Beta' },
      { id: '2', first_name: 'Duplicate', last_name: 'Ignored' },
    ])

    assert.deepEqual(
      rows.map((row) => row.id),
      ['1', '2'],
    )
    assert.equal(rows[0].name, 'Amy Beta')
  })
})
