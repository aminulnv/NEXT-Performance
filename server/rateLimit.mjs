import rateLimit from 'express-rate-limit'

const FIFTEEN_MINUTES = 15 * 60 * 1000
const ONE_HOUR = 60 * 60 * 1000

/** Off in local dev unless RATE_LIMIT_ENABLED=true; always on in production. */
export function isRateLimitEnabled(env = process.env) {
  if (env.RATE_LIMIT_DISABLED === 'true') return false
  return env.NODE_ENV === 'production' || env.RATE_LIMIT_ENABLED === 'true'
}

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

/** Prefer authenticated email when available (shared office NAT). */
export function rateLimitKey(req) {
  const email = req.user?.email
  if (typeof email === 'string' && email.trim()) {
    return email.trim().toLowerCase()
  }
  return clientIp(req)
}

function requestPath(req) {
  return (req.originalUrl ?? req.url ?? req.path ?? '').split('?')[0]
}

function skipWhenDisabled() {
  return !isRateLimitEnabled()
}

function skipHealthAndCron(req) {
  const path = requestPath(req)
  return path === '/api/health' || path === '/api/health/detail' || path.startsWith('/api/cron/')
}

function rateLimitResponse(_req, res, _next, options) {
  const retryAfterSeconds = Math.ceil((options.windowMs ?? FIFTEEN_MINUTES) / 1000)
  res.status(429).json({
    error: 'Too many requests. Please try again later.',
    retryAfterSeconds,
  })
}

export const authRateLimit = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipWhenDisabled,
  keyGenerator: clientIp,
  handler: rateLimitResponse,
})

export const apiRateLimit = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => skipWhenDisabled() || skipHealthAndCron(req),
  keyGenerator: rateLimitKey,
  handler: rateLimitResponse,
})

export const csvUploadRateLimit = rateLimit({
  windowMs: ONE_HOUR,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipWhenDisabled,
  keyGenerator: rateLimitKey,
  handler: rateLimitResponse,
})

export const forceRefreshRateLimit = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => skipWhenDisabled() || req.query?.refresh !== '1',
  keyGenerator: rateLimitKey,
  handler: rateLimitResponse,
})
