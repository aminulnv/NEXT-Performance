import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseGoalsCsv } from './parseGoalsCsv.mjs'

describe('parseGoalsCsv', () => {
  it('maps common headers', () => {
    const csv = `Employee ID,Employee,Cycle Name,Goal,Status,Progress
304,Api Singha,H2 2025,Improve automation,On track,60%`
    const { goals, columnMap } = parseGoalsCsv(csv)
    assert.equal(goals.length, 1)
    assert.equal(columnMap.employeeId, 'Employee ID')
    assert.equal(goals[0].employee_id, '304')
    assert.equal(goals[0].title, 'Improve automation')
  })
})
