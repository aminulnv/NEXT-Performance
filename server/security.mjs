import helmet from 'helmet'

function normalizeOrigin(url) {
  const trimmed = url?.trim().replace(/\/$/, '')
  if (!trimmed || /localhost|127\.0\.0\.1/i.test(trimmed)) return null
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
}

/** Browser origins allowed to call the API with credentials in production. */
export function buildCorsAllowlist(env = process.env, defaultOrigin = null) {
  const origins = new Set()

  const add = (value) => {
    const normalized = normalizeOrigin(value)
    if (normalized) origins.add(normalized)
  }

  add(defaultOrigin)
  add(env.APP_URL)
  add(env.VERCEL_PROJECT_PRODUCTION_URL)
  if (env.VERCEL_URL?.trim()) {
    add(`https://${env.VERCEL_URL.trim().replace(/\/$/, '')}`)
  }

  for (const part of env.CORS_ORIGINS?.split(',') ?? []) {
    add(part)
  }

  return origins
}

export function isProductionRuntime(env = process.env) {
  return env.NODE_ENV === 'production' || Boolean(env.VERCEL)
}

export function isCorsOriginAllowed(origin, allowlist, env = process.env) {
  if (!origin) return true
  const normalized = origin.replace(/\/$/, '')
  if (allowlist.has(normalized)) return true
  if (!isProductionRuntime(env)) return true
  return false
}

export function createCorsMiddleware({ allowlist, env = process.env } = {}) {
  const list = allowlist ?? buildCorsAllowlist(env)
  return {
    origin(origin, callback) {
      if (isCorsOriginAllowed(origin, list, env)) {
        return callback(null, true)
      }
      callback(null, false)
    },
    credentials: true,
  }
}

export function createHelmetMiddleware() {
  return helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
}

export function publicHealthPayload() {
  return { ok: true }
}
