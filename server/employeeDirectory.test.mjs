import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeEmployeeForDirectory, normalizeEmployeesList } from './employeeDirectory.mjs'

describe('employeeDirectory', () => {
  it('normalizes Revolut employee profile fields', () => {
    const raw = {
      id: 'emp-1',
      remote_id: 'rev-1',
      full_name: 'Ada Lovelace',
      first_name: 'Ada',
      middle_name: 'Augusta',
      last_name: 'Lovelace',
      email: 'Ada@Example.com',
      avatar: 'https://example.com/ada.png',
      status: 'active',
      joining_date_time: '2020-01-15T09:00:00Z',
      termination_date_time: null,
      updated_date_time: '2024-06-01T12:00:00Z',
      inactivity_reason: '',
      candidate_id: 'cand-99',
      location: { name: 'London' },
      entity: { name: 'Revolut Ltd' },
      team: {
        name: 'Platform',
        department: { name: 'Engineering' },
      },
      seniority: { name: 'Senior' },
      specialisation: { name: 'Backend Engineer' },
      line_manager: {
        id: 'mgr-1',
        first_name: 'Grace',
        last_name: 'Hopper',
        email: 'grace@example.com',
      },
    }

    const row = normalizeEmployeeForDirectory(raw)

    assert.deepEqual(row, {
      id: 'emp-1',
      remoteId: 'rev-1',
      name: 'Ada Lovelace',
      fullName: 'Ada Lovelace',
      firstName: 'Ada',
      middleName: 'Augusta',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      avatar: 'https://example.com/ada.png',
      department: 'Engineering',
      team: 'Platform',
      location: 'London',
      entity: 'Revolut Ltd',
      joiningDateTime: '2020-01-15T09:00:00Z',
      terminationDateTime: null,
      updatedDateTime: '2024-06-01T12:00:00Z',
      status: 'active',
      inactivityReason: null,
      specialisation: 'Backend Engineer',
      seniority: 'Senior',
      candidateId: 'cand-99',
      lineManagerId: 'mgr-1',
      lineManagerName: 'Grace Hopper',
      lineManagerEmail: 'grace@example.com',
      profile: raw,
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
