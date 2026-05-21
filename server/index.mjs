import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import session from 'express-session'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { buildCacheFromRevolut, saveCacheToDisk } from './buildCache.mjs'
import { readDiskCache } from './diskCache.mjs'
import { importGoalsFromCsv, loadGoalsDataset } from './goalsStore.mjs'
import {
  registerAuthRoutes,
  requireAuth,
  isAuthEnabled,
  validateAppUrlForProduction,
} from './auth.mjs'
import { registerAccessRoutes } from './accessRoutes.mjs'
import { registerPermissionsRoutes } from './permissionsRoutes.mjs'
import {
  initPermissionsConfig,
  seedPermissionsConfigIfEmpty,
  getPermissionsCacheMeta,
} from './permissionsStore.mjs'
import {
  registerEmployeeCacheAccessor,
  registerEmployeesDirectoryMerger,
} from './employeeLookup.mjs'
import {
  filterRecordsForUser,
  canAccessPerformanceApi,
  canUploadGoals,
  canForceRefresh,
  roleHasPage,
} from './permissions.mjs'
import { accessStorageBackend } from './accessStore.mjs'
import { isSupabaseConfigured, getSupabaseConfigHint } from './supabaseAdmin.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.join(__dirname, '..', 'dist')

validateAppUrlForProduction()

const app = express()
const port = Number(process.env.PORT || process.env.API_PORT) || 3001
const CACHE_MS = Number(process.env.API_CACHE_MS) || 60 * 60 * 1000
const STALE_REFRESH_MS = Number(process.env.STALE_REFRESH_MS) || 6 * 60 * 60 * 1000
const defaultOrigin = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '')

const corsAllowlist = new Set(
  [
    defaultOrigin,
    'https://next-performance.onrender.com',
    'https://next-performance-beta.vercel.app',
    process.env.APP_URL?.replace(/\/$/, ''),
  ].filter(Boolean),
)

app.set('trust proxy', 1)

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true)
      if (corsAllowlist.has(origin.replace(/\/$/, ''))) return callback(null, true)
      if (origin.endsWith('.vercel.app')) return callback(null, true)
      if (process.env.NODE_ENV !== 'production') return callback(null, true)
      callback(null, false)
    },
    credentials: true,
  }),
)
app.use(express.json())
app.use(express.text({ type: ['text/csv', 'text/plain'], limit: '15mb' }))

if (isAuthEnabled()) {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 16) {
    console.warn(
      '[auth] WARNING: Set SESSION_SECRET (min 16 chars) in .env for production sessions',
    )
  }
  app.use(
    session({
      name: 'pd.sid',
      secret: secret || 'dev-only-change-me-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  )
}

registerAuthRoutes(app)
registerAccessRoutes(app)
registerPermissionsRoutes(app)

let memoryCache = null
let memoryCacheAt = 0
let refreshInFlight = null

registerEmployeeCacheAccessor(() => memoryCache)

registerEmployeesDirectoryMerger((index) => {
  if (!memoryCache) return
  memoryCache.employeesByEmail = {
    ...(memoryCache.employeesByEmail ?? {}),
    ...index,
  }
})

function toApiPayload(cache, req) {
  const records = isAuthEnabled() && req.user
    ? filterRecordsForUser(cache.records, req.user)
    : cache.records

  return {
    fetchedAt: cache.fetchedAt,
    recordCount: records.length,
    records,
    cacheStatus: cache.cacheStatus ?? 'memory',
    refreshing: Boolean(refreshInFlight),
    warning: cache.warning,
  }
}

async function persistCache(data) {
  memoryCache = data
  memoryCacheAt = Date.now()
  await saveCacheToDisk(data)
}

async function refreshCache() {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    try {
      console.log('[cache] Refreshing from Revolut API…')
      const data = await buildCacheFromRevolut()
      await persistCache(data)
      console.log(`[cache] Saved ${data.recordCount} records`)
      return data
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

async function loadDiskIntoMemory() {
  const disk = await readDiskCache()
  if (!disk) return null
  memoryCache = {
    fetchedAt: disk.fetchedAt,
    recordCount: disk.recordCount,
    records: disk.records,
    employeesByEmail: disk.employeesByEmail ?? null,
    cacheStatus: 'disk',
  }
  memoryCacheAt = Date.now()
  return memoryCache
}

function scheduleBackgroundRefreshIfStale() {
  if (refreshInFlight || !memoryCache?.fetchedAt) return
  const age = Date.now() - new Date(memoryCache.fetchedAt).getTime()
  if (age < STALE_REFRESH_MS) return
  refreshCache().catch((err) => console.error('[cache] Background refresh failed:', err.message))
}

async function resolveCache({ force = false } = {}) {
  const now = Date.now()

  if (!force && memoryCache && now - memoryCacheAt < CACHE_MS) {
    return memoryCache
  }

  if (!force) {
    const disk = await readDiskCache()
    if (disk) {
      memoryCache = {
        fetchedAt: disk.fetchedAt,
        recordCount: disk.recordCount,
        records: disk.records,
        employeesByEmail: disk.employeesByEmail ?? null,
        cacheStatus: 'disk',
      }
      memoryCacheAt = now
      scheduleBackgroundRefreshIfStale()
      return memoryCache
    }
  }

  if (force) {
    return refreshCache()
  }

  if (refreshInFlight) {
    const disk = await readDiskCache()
    if (disk) {
      return {
        fetchedAt: disk.fetchedAt,
        recordCount: disk.recordCount,
        records: disk.records,
        cacheStatus: 'disk',
      }
    }
    return refreshInFlight
  }

  return refreshCache()
}

function requirePerformanceApiAccess(req, res, next) {
  if (!isAuthEnabled()) return next()
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  if (!canAccessPerformanceApi(req.user.role)) {
    return res.status(403).json({ error: 'You do not have access to performance data' })
  }
  next()
}

function requireGoalsRead(req, res, next) {
  if (!isAuthEnabled()) return next()
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  if (
    !roleHasPage(req.user.role, 'goals') &&
    !roleHasPage(req.user.role, 'analytics.monitoring')
  ) {
    return res.status(403).json({ error: 'You do not have access to goals' })
  }
  next()
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    refreshing: Boolean(refreshInFlight),
    authEnabled: isAuthEnabled(),
    accessStorage: accessStorageBackend(),
    permissionsStorage: getPermissionsCacheMeta().source,
    supabase: isSupabaseConfigured(),
  })
})

app.get('/api/goals', requireAuth, requireGoalsRead, async (req, res) => {
  try {
    const data = await loadGoalsDataset()
    res.json({
      goals: data.goals,
      columns: data.columns,
      columnMap: data.columnMap,
      importedAt: data.importedAt,
      source: data.source,
      sourcePath: data.sourcePath ?? null,
      hint: data.hint,
      goalCount: data.goals.length,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to load goals',
    })
  }
})

app.post('/api/goals', requireAuth, async (req, res) => {
  if (isAuthEnabled() && !canUploadGoals(req.user?.role)) {
    return res.status(403).json({ error: 'Only HR or administrators can upload goals CSV' })
  }
  try {
    const csvText = typeof req.body === 'string' ? req.body : ''
    if (!csvText.trim()) {
      return res.status(400).json({ error: 'Request body must be CSV text (Content-Type: text/csv)' })
    }
    const data = await importGoalsFromCsv(csvText)
    res.json({
      goals: data.goals,
      columns: data.columns,
      columnMap: data.columnMap,
      importedAt: data.importedAt,
      source: data.source,
      goalCount: data.goals.length,
    })
  } catch (err) {
    console.error(err)
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Failed to parse goals CSV',
    })
  }
})

app.get(
  '/api/performance-records',
  requireAuth,
  requirePerformanceApiAccess,
  async (req, res) => {
    try {
      const force = req.query.refresh === '1'
      if (force && isAuthEnabled() && !canForceRefresh(req.user?.role)) {
        return res.status(403).json({ error: 'Only HR or administrators can force a live refresh' })
      }
      const data = await resolveCache({ force })
      res.json(toApiPayload(data, req))
    } catch (err) {
      console.error(err)
      const disk = await readDiskCache()
      if (disk) {
        const stale = {
          fetchedAt: disk.fetchedAt,
          recordCount: disk.recordCount,
          records: disk.records,
          cacheStatus: 'disk-stale',
          refreshing: false,
          warning: err instanceof Error ? err.message : 'Live refresh failed; showing cached data',
        }
        return res.json(toApiPayload(stale, req))
      }
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load performance data',
      })
    }
  },
)

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

await initPermissionsConfig()
await seedPermissionsConfigIfEmpty()

const server = app.listen(port, async () => {
  console.log(`Performance API listening on http://localhost:${port}`)
  if (isAuthEnabled()) {
    console.log(`[auth] Google login enabled (default APP_URL=${defaultOrigin})`)
  } else {
    console.log('[auth] Disabled (VITE_BYPASS_AUTH=true or AUTH_DISABLED=true)')
  }
  const accessHint = getSupabaseConfigHint()
  if (accessHint) console.warn(`[access] ${accessHint}`)
  console.log(`[access] Storage: ${accessStorageBackend()}`)
  console.log(`[permissions] Storage: ${getPermissionsCacheMeta().source}`)
  if (isSupabaseConfigured()) {
    console.log('[supabase] User access → dashboard_users table')
  }
  const loaded = await loadDiskIntoMemory()
  if (loaded) {
    console.log(`[cache] Loaded ${loaded.recordCount} records from disk (instant serve)`)
    scheduleBackgroundRefreshIfStale()
  } else {
    console.log('[cache] No disk cache — run: npm run cache:warm')
  }
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `[api] Port ${port} is already in use. Stop the other process: lsof -ti :${port} | xargs kill -9`,
    )
    process.exit(1)
  }
  throw err
})
