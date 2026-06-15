import { OAuth2Client } from 'google-auth-library'
import { resolveUserRole, getUserAccess } from './accessStore.mjs'
import { loadPermissionsConfig, roleHasPage } from './permissions.mjs'
import { normalizeScopedDepartments } from './departmentScope.mjs'
import { authRateLimit } from './rateLimit.mjs'
import { audit } from './auditLog.mjs'
import { consumeOAuthState, issueOAuthState } from './oauthState.mjs'

function isLocalhostUrl(url) {
  return /localhost|127\.0\.0\.1/i.test(url ?? '')
}

/** Vercel sets VERCEL_URL (hostname only) on each deployment. */
function vercelPublicUrl() {
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim().replace(/\/$/, '')
  if (production && !isLocalhostUrl(production)) {
    return production.startsWith('http') ? production : `https://${production}`
  }
  const host = process.env.VERCEL_URL?.trim().replace(/\/$/, '')
  if (host && !isLocalhostUrl(host)) {
    return host.startsWith('http') ? host : `https://${host}`
  }
  return null
}

/** Public site URL — from APP_URL, request Host (Vercel), or VERCEL_URL. */
export function getAppUrl(req) {
  const explicit = process.env.APP_URL?.trim().replace(/\/$/, '')
  if (explicit && !isLocalhostUrl(explicit)) {
    return explicit
  }
  if (req) {
    const host = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim()
    const proto = (req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http'))
      .split(',')[0]
      .trim()
    if (host && !isLocalhostUrl(host)) {
      return `${proto}://${host}`.replace(/\/$/, '')
    }
  }
  const onVercel = vercelPublicUrl()
  if (onVercel) return onVercel
  return (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '')
}

/** Default origin for CORS / logging when no request is available. */
export function getDefaultAppOrigin() {
  const explicit = process.env.APP_URL?.trim().replace(/\/$/, '')
  if (explicit && !isLocalhostUrl(explicit)) return explicit
  const onVercel = vercelPublicUrl()
  if (onVercel) return onVercel
  return 'http://localhost:5173'
}

/** Send users to the public site they used to sign in (not localhost). */
function redirectToApp(res, path, req) {
  const base = getAppUrl(req)
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return res.redirect(path)
  }
  const normalized = path.startsWith('/') ? path : `/${path}`
  return res.redirect(`${base}${normalized}`)
}

export function validateAppUrlForProduction() {
  if (process.env.NODE_ENV !== 'production') return
  const url = process.env.APP_URL?.trim()
  const vercelUrl = vercelPublicUrl()
  if (url && isLocalhostUrl(url)) {
    console.warn(
      `[auth] APP_URL is localhost (${url}) — ignored; using request Host or VERCEL_URL (${vercelUrl ?? 'none'}).`,
    )
  } else if (!url) {
    console.log(
      `[auth] APP_URL not set — OAuth redirects use request Host or VERCEL_URL (${vercelUrl ?? 'none'}).`,
    )
  }
}

function getOAuthClient(req) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env')
  }
  const redirectUri = `${getAppUrl(req)}/api/auth/google/callback`
  return new OAuth2Client(clientId, clientSecret, redirectUri)
}

function allowedDomain() {
  return (process.env.ALLOWED_EMAIL_DOMAIN || '').trim().toLowerCase()
}

export const MIN_SESSION_SECRET_LENGTH = 16
export const DEFAULT_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000

export function resolveSessionMaxAge(env = process.env) {
  const raw = env.SESSION_MAX_AGE_MS?.trim()
  if (!raw) return DEFAULT_SESSION_MAX_AGE_MS
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('[auth] SESSION_MAX_AGE_MS must be a positive number of milliseconds')
  }
  return parsed
}

/** Production runtime — Vercel sets VERCEL even when NODE_ENV is unset locally. */
export function isProductionRuntime(env = process.env) {
  return env.NODE_ENV === 'production' || Boolean(env.VERCEL)
}

export function isAuthBypassRequested(env = process.env) {
  return env.VITE_BYPASS_AUTH === 'true' || env.AUTH_DISABLED === 'true'
}

/** Auth bypass is dev-only; production always requires login. */
export function isAuthEnabled(env = process.env) {
  if (isProductionRuntime(env)) return true
  return !isAuthBypassRequested(env)
}

export function resolveSessionSecret(env = process.env) {
  const secret = env.SESSION_SECRET?.trim()
  if (isProductionRuntime(env)) {
    if (!secret || secret.length < MIN_SESSION_SECRET_LENGTH) {
      throw new Error(
        `[auth] SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters in production`,
      )
    }
    return secret
  }
  if (!secret || secret.length < MIN_SESSION_SECRET_LENGTH) {
    console.warn(
      `[auth] WARNING: Set SESSION_SECRET (min ${MIN_SESSION_SECRET_LENGTH} chars) in .env for production sessions`,
    )
  }
  return secret || 'dev-only-change-me-in-production'
}

/** @returns {{ ok: true } | { ok: false, errors: string[] }} */
export function validateAuthProductionConfig(env = process.env) {
  if (!isProductionRuntime(env)) return { ok: true }

  const errors = []
  if (isAuthBypassRequested(env)) {
    errors.push(
      'VITE_BYPASS_AUTH and AUTH_DISABLED must not be set in production — remove them from deploy env vars',
    )
  }
  const secret = env.SESSION_SECRET?.trim()
  if (!secret || secret.length < MIN_SESSION_SECRET_LENGTH) {
    errors.push(
      `SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters in production`,
    )
  }
  if (!env.GOOGLE_CLIENT_ID?.trim() || !env.GOOGLE_CLIENT_SECRET?.trim()) {
    errors.push('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required in production')
  }
  return errors.length ? { ok: false, errors } : { ok: true }
}

export function assertAuthProductionSafe() {
  const result = validateAuthProductionConfig()
  if (result.ok) return
  for (const message of result.errors) {
    console.error(`[auth] FATAL: ${message}`)
  }
  process.exit(1)
}

export function attachSessionUser(session, { email, name, picture, sub, role, employeeId }) {
  session.user = {
    email,
    name: name ?? email,
    picture: picture ?? null,
    sub,
    role,
    employeeId: employeeId ?? null,
  }
}

async function enrichUserFromAccessStore(user) {
  if (!user?.email) return user
  try {
    const access = await getUserAccess(user.email)
    if (!access) return user
    return {
      ...user,
      scopedDepartments: normalizeScopedDepartments(access.scopedDepartments),
    }
  } catch (err) {
    console.warn('[auth] Could not load user department scope:', err)
    return user
  }
}

export function registerAuthRoutes(app) {
  if (!isAuthEnabled()) return

  app.get('/api/auth/google', authRateLimit, (req, res, next) => {
    try {
      saveReturnTo(req.session, req.query.returnTo)
      const client = getOAuthClient(req)
      const state = issueOAuthState(req.session)
      const url = client.generateAuthUrl({
        access_type: 'online',
        scope: ['openid', 'email', 'profile'],
        prompt: 'select_account',
        state,
      })
      res.redirect(url)
    } catch (err) {
      next(err)
    }
  })

  app.get('/api/auth/google/callback', authRateLimit, async (req, res) => {
    const code = req.query.code
    if (!code || typeof code !== 'string') {
      return redirectToApp(res, '/login?error=missing_code', req)
    }
    if (!consumeOAuthState(req.session, typeof req.query.state === 'string' ? req.query.state : null)) {
      return redirectToApp(res, '/login?error=invalid_state', req)
    }

    try {
      const client = getOAuthClient(req)
      const { tokens } = await client.getToken(code)
      if (!tokens.id_token) {
        return redirectToApp(res, '/login?error=no_id_token', req)
      }

      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      })
      const payload = ticket.getPayload()
      if (!payload?.email) {
        return redirectToApp(res, '/login?error=no_email', req)
      }

      const email = payload.email.toLowerCase()
      const domain = allowedDomain()
      if (domain && !email.endsWith(`@${domain}`)) {
        return redirectToApp(res, '/login?error=domain_not_allowed', req)
      }

      const access = await resolveUserRole(email, payload.name)
      if (!access) {
        return redirectToApp(res, '/login?error=no_access', req)
      }

      attachSessionUser(req.session, {
        email,
        name: payload.name,
        picture: payload.picture,
        sub: payload.sub,
        role: access.role,
        employeeId: access.employeeId,
      })

      audit({
        action: 'auth.login',
        actorEmail: email,
        actorRole: access.role,
        req,
      })

      const redirectTo = typeof req.session.returnTo === 'string' ? req.session.returnTo : '/'
      delete req.session.returnTo
      redirectToApp(res, redirectTo, req)
    } catch (err) {
      console.error('[auth] callback failed:', err)
      redirectToApp(res, '/login?error=auth_failed', req)
    }
  })

  app.get('/api/auth/me', async (req, res) => {
    if (!req.session?.user) {
      return res.status(401).json({ authenticated: false })
    }
    const enriched = await enrichUserFromAccessStore(req.session.user)
    const { email, name, picture, role, employeeId, scopedDepartments } = enriched
    const config = loadPermissionsConfig()
    res.json({
      authenticated: true,
      user: {
        id: req.session.user.sub ?? email,
        email,
        name,
        picture,
        role,
        employeeId,
        scopedDepartments: scopedDepartments ?? null,
        roleLabel: config.roles[role]?.label ?? role,
      },
      permissions: {
        pages: config.roles[role]?.pages ?? [],
      },
    })
  })

  app.post('/api/auth/logout', (req, res) => {
    const sessionUser = req.session?.user
    audit({
      action: 'auth.logout',
      actorEmail: sessionUser?.email ?? null,
      actorRole: sessionUser?.role ?? null,
      req,
    })
    req.session = null
    res.json({ ok: true })
  })
}

export async function requireAuth(req, res, next) {
  if (!isAuthEnabled()) {
    req.user = {
      email: 'dev@local',
      name: 'Dev',
      role: 'admin',
      employeeId: null,
      scopedDepartments: null,
    }
    return next()
  }
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  try {
    req.user = await enrichUserFromAccessStore(req.session.user)
    next()
  } catch (err) {
    next(err)
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!isAuthEnabled()) return next()
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }
    next()
  }
}

/** Store return path before redirecting to Google (login page calls this). */
export function saveReturnTo(session, returnTo) {
  if (typeof returnTo === 'string' && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
    session.returnTo = returnTo
  }
}

export function requirePageKey(pageKey) {
  return (req, res, next) => {
    if (!isAuthEnabled()) return next()
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    if (!roleHasPage(req.user.role, pageKey)) {
      return res.status(403).json({ error: 'You do not have access to this resource' })
    }
    next()
  }
}
