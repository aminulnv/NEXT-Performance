import { OAuth2Client } from 'google-auth-library'
import { resolveUserRole } from './accessStore.mjs'
import { loadPermissionsConfig, roleHasPage } from './permissions.mjs'

function getAppUrl() {
  return (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '')
}

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env')
  }
  const redirectUri = `${getAppUrl()}/api/auth/google/callback`
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
      const client = getOAuthClient()
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
      return res.redirect('/login?error=missing_code')
    }

    try {
      const client = getOAuthClient()
      const { tokens } = await client.getToken(code)
      if (!tokens.id_token) {
        return res.redirect('/login?error=no_id_token')
      }

      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      })
      const payload = ticket.getPayload()
      if (!payload?.email) {
        return res.redirect('/login?error=no_email')
      }

      const email = payload.email.toLowerCase()
      const domain = allowedDomain()
      if (domain && !email.endsWith(`@${domain}`)) {
        return res.redirect('/login?error=domain_not_allowed')
      }

      const access = await resolveUserRole(email, payload.name)
      if (!access) {
        return res.redirect('/login?error=no_access')
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
      res.redirect(redirectTo)
    } catch (err) {
      console.error('[auth] callback failed:', err)
      res.redirect('/login?error=auth_failed')
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
    req.session.destroy((err) => {
      if (err) {
        console.error(err)
        return res.status(500).json({ error: 'Logout failed' })
      }
      res.clearCookie('pd.sid')
      res.json({ ok: true })
    })
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
