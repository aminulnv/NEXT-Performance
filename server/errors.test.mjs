import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  HttpError,
  clientErrorMessage,
  errorResponseBody,
  statusCodeFor,
} from './errors.mjs'

describe('HttpError', () => {
  it('defaults expose to true for 4xx', () => {
    const err = new HttpError(400, 'Bad input')
    assert.equal(err.expose, true)
    assert.equal(statusCodeFor(err), 400)
  })

  it('defaults expose to false for 5xx', () => {
    const err = new HttpError(500, 'Server failed')
    assert.equal(err.expose, false)
  })
})

describe('clientErrorMessage', () => {
  it('returns public message for HttpError in production', () => {
    assert.equal(
      clientErrorMessage(new HttpError(502, 'Upstream unavailable'), { NODE_ENV: 'production' }),
      'Upstream unavailable',
    )
  })

  it('hides internal Error details in production', () => {
    assert.equal(
      clientErrorMessage(new Error('SUPABASE_SERVICE_ROLE_KEY missing'), { NODE_ENV: 'production' }),
      'An unexpected error occurred',
    )
  })

  it('shows internal Error details in development', () => {
    assert.equal(
      clientErrorMessage(new Error('debug detail'), { NODE_ENV: 'development' }),
      'debug detail',
    )
  })
})

describe('errorResponseBody', () => {
  it('includes details when HttpError exposes them', () => {
    assert.deepEqual(
      errorResponseBody(new HttpError(400, 'Invalid CSV', { details: ['row 1'] })),
      { error: 'Invalid CSV', details: ['row 1'] },
    )
  })
})
