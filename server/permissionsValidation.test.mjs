import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  validatePermissionsConfig,
  slugifyRoleId,
  isValidRoleId,
} from './permissionsValidation.mjs'

const basePages = { home: { label: 'Home', path: '/' } }

describe('permissionsValidation', () => {
  it('slugifyRoleId', () => {
    assert.equal(slugifyRoleId('People Ops'), 'people_ops')
  })

  it('rejects invalid role ids', () => {
    assert.equal(isValidRoleId('Admin'), false)
    assert.equal(isValidRoleId('analyst'), true)
  })

  it('requires an admin role', () => {
    assert.throws(() =>
      validatePermissionsConfig({
        pages: basePages,
        roles: {
          viewer: { label: 'Viewer', pages: ['home'] },
        },
      }),
    )
  })

  it('allows custom role', () => {
    const config = validatePermissionsConfig({
      pages: basePages,
      roles: {
        admin: { label: 'Admin', pages: ['*'], manageUsers: true, system: true },
        analyst: {
          label: 'Analyst',
          pages: ['home'],
          dataAccess: 'full',
        },
      },
    })
    assert.equal(config.roles.analyst.dataAccess, 'full')
    assert.equal(config.roles.analyst.system, false)
  })

  it('blocks removing role with users', () => {
    assert.throws(() =>
      validatePermissionsConfig(
        {
          pages: basePages,
          roles: {
            admin: { label: 'Admin', pages: ['*'], manageUsers: true },
          },
        },
        { removedRoleIds: ['hr'], usersByRole: { hr: 2 } },
      ),
    )
  })
})
