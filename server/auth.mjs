import { OAuth2Client } from 'google-auth-library'
import { resolveUserRole } from './accessStore.mjs'
import { loadPermissionsConfig, roleHasPage } from './permissions.mjs'

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

export function isAuthEnabled() {
  return process.env.VITE_BYPASS_AUTH !== 'true' && process.env.AUTH_DISABLED !== 'true'
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

export function registerAuthRoutes(app) {
  if (!isAuthEnabled()) return

  app.get('/api/auth/google', (req, res) => {
    try {
      saveReturnTo(req.session, req.query.returnTo)
      const client = getOAuthClient(req)
      const url = client.generateAuthUrl({
        access_type: 'online',
        scope: ['openid', 'email', 'profile'],
        prompt: 'select_account',
      })
      res.redirect(url)
    } catch (err) {
      console.error(err)
      res.status(500).send(err instanceof Error ? err.message : 'Auth not configured')
    }
  })

  app.get('/api/auth/google/callback', async (req, res) => {
    const code = req.query.code
    if (!code || typeof code !== 'string') {
      return redirectToApp(res, '/login?error=missing_code', req)
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

      const redirectTo = typeof req.session.returnTo === 'string' ? req.session.returnTo : '/'
      delete req.session.returnTo
      redirectToApp(res, redirectTo, req)
    } catch (err) {
      console.error('[auth] callback failed:', err)
      redirectToApp(res, '/login?error=auth_failed', req)
    }
  })

  app.get('/api/auth/me', (req, res) => {
    if (!req.session?.user) {
      return res.status(401).json({ authenticated: false })
    }
    const { email, name, picture, role, employeeId } = req.session.user
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
        roleLabel: config.roles[role]?.label ?? role,
      },
      permissions: {
        pages: config.roles[role]?.pages ?? [],
      },
    })
  })

  app.post('/api/auth/logout', (req, res) => {
    req.session = null
    res.json({ ok: true })
  })
}

export function requireAuth(req, res, next) {
  if (!isAuthEnabled()) {
    req.user = {
      email: 'dev@local',
      name: 'Dev',
      role: 'admin',
      employeeId: null,
    }
    return next()
  }
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  req.user = req.session.user
  next()
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
