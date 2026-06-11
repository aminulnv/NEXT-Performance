import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isRateLimitEnabled, rateLimitKey } from './rateLimit.mjs'

describe('isRateLimitEnabled', () => {
  it('is off in local dev by default', () => {
    assert.equal(isRateLimitEnabled({ NODE_ENV: 'development' }), false)
  })

  it('is on in production', () => {
    assert.equal(isRateLimitEnabled({ NODE_ENV: 'production' }), true)
  })

  it('can be forced on in dev with RATE_LIMIT_ENABLED', () => {
    assert.equal(
      isRateLimitEnabled({ NODE_ENV: 'development', RATE_LIMIT_ENABLED: 'true' }),
      true,
    )
  })

  it('can be disabled with RATE_LIMIT_DISABLED', () => {
    assert.equal(
      isRateLimitEnabled({ NODE_ENV: 'production', RATE_LIMIT_DISABLED: 'true' }),
      false,
    )
  })
})

describe('rateLimitKey', () => {
  it('uses authenticated email when present', () => {
    assert.equal(
      rateLimitKey({ user: { email: 'Admin@Example.com' }, ip: '1.2.3.4' }),
      'admin@example.com',
    )
  })

  it('falls back to IP when user is absent', () => {
    assert.equal(rateLimitKey({ ip: '10.0.0.5' }), '10.0.0.5')
  })
})
