import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildReportingGraphFromRecords,
  subtreeEmployeeIds,
} from './reportingTree.mjs'

function record(employeeId, managerId, email) {
  return {
    employee_id: employeeId,
    payload: {
      'Employee ID': employeeId,
      'Employee Email': email,
      'Line Manager (HR profile) ID': managerId,
    },
  }
}

describe('reportingTree', () => {
  it('includes indirect reports in subtree', () => {
    const records = [
      record('fahim', null, 'fahim@co.com'),
      record('abhi', 'fahim', 'abhi@co.com'),
      record('aminul', 'abhi', 'aminul@co.com'),
      record('saif', 'abhi', 'saif@co.com'),
    ]
    const { directReports } = buildReportingGraphFromRecords(records)

    const fahimTree = subtreeEmployeeIds('fahim', directReports)
    assert.ok(fahimTree.has('abhi'))
    assert.ok(fahimTree.has('aminul'))
    assert.ok(fahimTree.has('saif'))
    assert.equal(fahimTree.size, 3)

    const abhiTree = subtreeEmployeeIds('abhi', directReports)
    assert.ok(abhiTree.has('aminul'))
    assert.ok(abhiTree.has('saif'))
    assert.equal(abhiTree.size, 2)
  })
})
