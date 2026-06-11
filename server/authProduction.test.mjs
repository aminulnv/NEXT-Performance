import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isAuthEnabled,
  isAuthBypassRequested,
  isProductionRuntime,
  validateAuthProductionConfig,
  resolveSessionSecret,
  MIN_SESSION_SECRET_LENGTH,
} from './auth.mjs'

describe('isProductionRuntime', () => {
  it('is true when NODE_ENV is production', () => {
    assert.equal(isProductionRuntime({ NODE_ENV: 'production' }), true)
  })

  it('is true when VERCEL is set', () => {
    assert.equal(isProductionRuntime({ VERCEL: '1' }), true)
  })

  it('is false in local dev', () => {
    assert.equal(isProductionRuntime({ NODE_ENV: 'development' }), false)
  })
})

describe('isAuthEnabled', () => {
  it('allows bypass in local dev when flags are set', () => {
    assert.equal(
      isAuthEnabled({ NODE_ENV: 'development', VITE_BYPASS_AUTH: 'true' }),
      false,
    )
  })

  it('forces auth on in production even when bypass flags are set', () => {
    assert.equal(
      isAuthEnabled({ NODE_ENV: 'production', VITE_BYPASS_AUTH: 'true' }),
      true,
    )
    assert.equal(
      isAuthEnabled({ VERCEL: '1', AUTH_DISABLED: 'true' }),
      true,
    )
  })
})

describe('validateAuthProductionConfig', () => {
  const validProd = {
    NODE_ENV: 'production',
    SESSION_SECRET: 'a'.repeat(MIN_SESSION_SECRET_LENGTH),
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
  }

  it('passes with valid production config', () => {
    assert.deepEqual(validateAuthProductionConfig(validProd), { ok: true })
  })

  it('skips validation outside production', () => {
    assert.deepEqual(
      validateAuthProductionConfig({ NODE_ENV: 'development', VITE_BYPASS_AUTH: 'true' }),
      { ok: true },
    )
  })

  it('rejects auth bypass flags in production', () => {
    const result = validateAuthProductionConfig({
      ...validProd,
      VITE_BYPASS_AUTH: 'true',
    })
    assert.equal(result.ok, false)
    assert.match(result.errors.join(' '), /VITE_BYPASS_AUTH/)
  })

  it('rejects missing SESSION_SECRET in production', () => {
    const result = validateAuthProductionConfig({
      ...validProd,
      SESSION_SECRET: 'short',
    })
    assert.equal(result.ok, false)
    assert.match(result.errors.join(' '), /SESSION_SECRET/)
  })

  it('rejects missing Google OAuth credentials in production', () => {
    const result = validateAuthProductionConfig({
      ...validProd,
      GOOGLE_CLIENT_SECRET: '',
    })
    assert.equal(result.ok, false)
    assert.match(result.errors.join(' '), /GOOGLE_CLIENT/)
  })
})

describe('resolveSessionSecret', () => {
  it('returns dev fallback when secret is unset locally', () => {
    assert.equal(
      resolveSessionSecret({ NODE_ENV: 'development' }),
      'dev-only-change-me-in-production',
    )
  })

  it('throws in production when secret is too short', () => {
    assert.throws(
      () => resolveSessionSecret({ NODE_ENV: 'production', SESSION_SECRET: 'short' }),
      /SESSION_SECRET must be at least/,
    )
  })
})

describe('isAuthBypassRequested', () => {
  it('detects either bypass flag', () => {
    assert.equal(isAuthBypassRequested({ VITE_BYPASS_AUTH: 'true' }), true)
    assert.equal(isAuthBypassRequested({ AUTH_DISABLED: 'true' }), true)
    assert.equal(isAuthBypassRequested({}), false)
  })
})
