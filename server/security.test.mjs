import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildCorsAllowlist,
  isCorsOriginAllowed,
  isProductionRuntime,
  publicHealthPayload,
} from './security.mjs'

describe('buildCorsAllowlist', () => {
  it('includes configured production origins', () => {
    const list = buildCorsAllowlist(
      {
        APP_URL: 'https://app.example.com',
        VERCEL_PROJECT_PRODUCTION_URL: 'https://prod.example.com',
        CORS_ORIGINS: 'https://extra.example.com',
      },
      'https://default.example.com',
    )
    assert.equal(list.has('https://app.example.com'), true)
    assert.equal(list.has('https://prod.example.com'), true)
    assert.equal(list.has('https://default.example.com'), true)
    assert.equal(list.has('https://extra.example.com'), true)
  })

  it('ignores localhost origins', () => {
    const list = buildCorsAllowlist({ APP_URL: 'http://localhost:5173' })
    assert.equal(list.size, 0)
  })
})

describe('isCorsOriginAllowed', () => {
  const allowlist = new Set(['https://app.example.com'])

  it('allows listed origins in production', () => {
    assert.equal(
      isCorsOriginAllowed('https://app.example.com', allowlist, { NODE_ENV: 'production' }),
      true,
    )
  })

  it('blocks unknown origins in production', () => {
    assert.equal(
      isCorsOriginAllowed('https://evil.vercel.app', allowlist, { NODE_ENV: 'production' }),
      false,
    )
  })

  it('allows any origin in local dev', () => {
    assert.equal(
      isCorsOriginAllowed('https://random.test', allowlist, { NODE_ENV: 'development' }),
      true,
    )
  })

  it('allows missing Origin header', () => {
    assert.equal(isCorsOriginAllowed(undefined, allowlist, { NODE_ENV: 'production' }), true)
  })
})

describe('isProductionRuntime', () => {
  it('is true on Vercel', () => {
    assert.equal(isProductionRuntime({ VERCEL: '1' }), true)
  })
})

describe('publicHealthPayload', () => {
  it('returns minimal public shape', () => {
    assert.deepEqual(publicHealthPayload(), { ok: true })
  })
})
