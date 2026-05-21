import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseAccessCsv } from './parseAccessCsv.mjs'
import { initPermissionsConfig } from './permissionsStore.mjs'

await initPermissionsConfig()

test('parseAccessCsv maps email and role', () => {
  const csv = `email,role,employee_id
a@nextventures.io,hr,
b@nextventures.io,manager,99`
  const { users, errors } = parseAccessCsv(csv)
  assert.equal(errors.length, 0)
  assert.equal(users.length, 2)
  assert.equal(users[0].email, 'a@nextventures.io')
  assert.equal(users[0].role, 'hr')
  assert.equal(users[1].employeeId, '99')
})

test('parseAccessCsv rejects invalid role', () => {
  const { errors } = parseAccessCsv('email,role\nx@co.com,boss')
  assert.ok(errors.some((e) => e.includes('invalid role')))
})
