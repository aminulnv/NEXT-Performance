import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { consumeOAuthState, issueOAuthState } from './oauthState.mjs'

describe('oauthState', () => {
  it('accepts matching state once', () => {
    const session = {}
    const state = issueOAuthState(session)
    assert.equal(consumeOAuthState(session, state), true)
    assert.equal(consumeOAuthState(session, state), false)
  })

  it('rejects missing or tampered state', () => {
    const session = {}
    const state = issueOAuthState(session)
    assert.equal(consumeOAuthState(session, `${state}x`), false)
    assert.equal(consumeOAuthState({}, state), false)
  })
})
