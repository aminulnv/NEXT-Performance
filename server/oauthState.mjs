import { randomBytes, timingSafeEqual } from 'crypto'

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000

/** Bind OAuth callback to the browser session that started login (CSRF protection). */
export function issueOAuthState(session) {
  const state = randomBytes(32).toString('hex')
  session.oauthState = state
  session.oauthStateAt = Date.now()
  return state
}

export function consumeOAuthState(session, receivedState) {
  if (typeof receivedState !== 'string' || !receivedState.trim()) return false
  const expected = session?.oauthState
  const issuedAt = session?.oauthStateAt
  delete session.oauthState
  delete session.oauthStateAt
  if (!expected || typeof issuedAt !== 'number') return false
  if (Date.now() - issuedAt > OAUTH_STATE_TTL_MS) return false

  try {
    const a = Buffer.from(expected, 'utf8')
    const b = Buffer.from(receivedState, 'utf8')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}
