import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { auditActor, buildAuditEntry, clientIp } from './auditLog.mjs'

describe('clientIp', () => {
  it('prefers x-forwarded-for first hop', () => {
    assert.equal(
      clientIp({ headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' }, ip: '127.0.0.1' }),
      '203.0.113.1',
    )
  })

  it('falls back to req.ip', () => {
    assert.equal(clientIp({ ip: '192.168.1.10' }), '192.168.1.10')
  })
})

describe('auditActor', () => {
  it('reads from req.user', () => {
    assert.deepEqual(auditActor({ user: { email: 'A@Co.com', role: 'admin' } }), {
      actorEmail: 'a@co.com',
      actorRole: 'admin',
    })
  })

  it('falls back to req.session.user', () => {
    assert.deepEqual(
      auditActor({ session: { user: { email: 'x@y.z', role: 'hr' } } }),
      { actorEmail: 'x@y.z', actorRole: 'hr' },
    )
  })
})

describe('buildAuditEntry', () => {
  it('builds a normalized row with metadata', () => {
    const entry = buildAuditEntry({
      action: 'auth.login',
      actorEmail: 'user@example.com',
      actorRole: 'manager',
      target: 'user@example.com',
      metadata: { source: 'google' },
      req: {
        ip: '10.0.0.2',
        get: () => 'TestAgent/1.0',
      },
      requestId: '00000000-0000-4000-8000-000000000001',
    })

    assert.equal(entry.action, 'auth.login')
    assert.equal(entry.actor_email, 'user@example.com')
    assert.equal(entry.actor_role, 'manager')
    assert.equal(entry.target, 'user@example.com')
    assert.deepEqual(entry.metadata, { source: 'google' })
    assert.equal(entry.ip_address, '10.0.0.2')
    assert.equal(entry.user_agent, 'TestAgent/1.0')
    assert.equal(entry.request_id, '00000000-0000-4000-8000-000000000001')
  })

  it('requires action', () => {
    assert.throws(() => buildAuditEntry({}), /action is required/)
  })
})
