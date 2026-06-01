import express from 'express'
import cors from 'cors'
import cookieSession from 'cookie-session'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { buildCacheFromRevolut, saveCache } from './buildCache.mjs'
import { readDiskCache } from './diskCache.mjs'
import { importGoalsFromCsv, loadGoalsDataset, goalsStorageBackend } from './goalsStore.mjs'
import {
  registerAuthRoutes,
  requireAuth,
  isAuthEnabled,
  validateAppUrlForProduction,
  getDefaultAppOrigin,
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
import { fetchRevolutEmployeesList } from './revolutEmployees.mjs'
import { accessStorageBackend } from './accessStore.mjs'
import {
  isEmployeesSupabaseEnabled,
  loadEmployeesFromSupabase,
} from './employeesStoreSupabase.mjs'
import { isSupabaseConfigured, getSupabaseConfigHint } from './supabaseAdmin.mjs'
import {
  loadPerformanceCacheFromSupabase,
  isPerformanceSupabaseCacheEnabled,
  getPerformanceCacheConfigHint,
} from './performanceStoreSupabase.mjs'
import { getPlatformLabel, isServerless, requiresSupabaseStorage } from './runtime.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.join(__dirname, '..', 'dist')

validateAppUrlForProduction()

const app = express()
const CACHE_MS = Number(process.env.API_CACHE_MS) || 60 * 60 * 1000
const STALE_REFRESH_MS = Number(process.env.STALE_REFRESH_MS) || 6 * 60 * 60 * 1000
const defaultOrigin = getDefaultAppOrigin()

const corsAllowlist = new Set(
  [
    defaultOrigin,
    'https://next-performance-beta.vercel.app',
    process.env.APP_URL?.replace(/\/$/, ''),
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/\/$/, ''),
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/\/$/, '')}` : null,
  ].filter((origin) => origin && !/localhost|127\.0\.0\.1/i.test(origin)),
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
    cookieSession({
      name: 'pd.sid',
      keys: [secret || 'dev-only-change-me-in-production'],
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
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
  await saveCache(data)
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
  if (isServerless()) return null
  const disk = await readDiskCache()
  if (!disk) return null
  memoryCache = {
    fetchedAt: disk.fetchedAt,
    recordCount: disk.recordCount,
    records: disk.records,
    employeesByEmail: disk.employeesByEmail ?? null,
    employeesDirectory: disk.employeesDirectory ?? null,
    cacheStatus: 'disk',
  }
  memoryCacheAt = Date.now()
  return memoryCache
}

function scheduleBackgroundRefreshIfStale() {
  if (isServerless() || refreshInFlight || !memoryCache?.fetchedAt) return
  const age = Date.now() - new Date(memoryCache.fetchedAt).getTime()
  if (age < STALE_REFRESH_MS) return
  refreshCache().catch((err) => console.error('[cache] Background refresh failed:', err.message))
}

async function loadPersistedCache() {
  if (isPerformanceSupabaseCacheEnabled()) {
    const fromDb = await loadPerformanceCacheFromSupabase()
    if (fromDb) return fromDb
  }
  if (isServerless()) return null
  const disk = await readDiskCache()
  if (!disk) return null
  return {
    fetchedAt: disk.fetchedAt,
    recordCount: disk.recordCount,
    records: disk.records,
    employeesByEmail: disk.employeesByEmail ?? null,
    employeesDirectory: disk.employeesDirectory ?? null,
    cacheStatus: 'disk',
  }
}

function applyMemoryCache(data) {
  memoryCache = data
  memoryCacheAt = Date.now()
  return memoryCache
}

async function resolveCache({ force = false } = {}) {
  const now = Date.now()

  if (!force && !isServerless() && memoryCache && now - memoryCacheAt < CACHE_MS) {
    return memoryCache
  }

  if (!force) {
    const persisted = await loadPersistedCache()
    if (persisted) {
      applyMemoryCache(persisted)
      scheduleBackgroundRefreshIfStale()
      return memoryCache
    }
  }

  if (force) {
    return refreshCache()
  }

  if (refreshInFlight) {
    const persisted = await loadPersistedCache()
    if (persisted) return persisted
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

function verifyCronSecret(req, res) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      res.status(503).json({ error: 'CRON_SECRET is not configured' })
      return false
    }
    return true
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}

const ready = initPermissionsConfig()
  .then(() => seedPermissionsConfigIfEmpty())
  .then(() => {
    if (requiresSupabaseStorage() && !isSupabaseConfigured()) {
      console.warn(
        '[runtime] VERCEL deployment requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — file storage is unavailable.',
      )
    }
    return loadDiskIntoMemory()
  })
  .then((loaded) => {
    if (loaded) {
      console.log(`[cache] Loaded ${loaded.recordCount} records from disk (instant serve)`)
      scheduleBackgroundRefreshIfStale()
    } else if (!isServerless()) {
      console.log('[cache] No disk cache — run: npm run cache:warm')
    }
  })

app.use(async (_req, _res, next) => {
  try {
    await ready
    next()
  } catch (err) {
    next(err)
  }
})

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    platform: getPlatformLabel(),
    refreshing: Boolean(refreshInFlight),
    authEnabled: isAuthEnabled(),
    accessStorage: accessStorageBackend(),
    permissionsStorage: getPermissionsCacheMeta().source,
    supabase: isSupabaseConfigured(),
    performanceCache: isPerformanceSupabaseCacheEnabled() ? 'supabase-encrypted' : 'disk',
    employeesStorage: isEmployeesSupabaseEnabled() ? 'supabase' : 'local',
    goalsStorage: goalsStorageBackend(),
  })
})

app.get('/api/cron/warm-cache', async (req, res) => {
  if (!verifyCronSecret(req, res)) return
  try {
    console.log('[cron] Warming performance cache from Revolut…')
    const data = await buildCacheFromRevolut()
    await saveCache(data)
    res.json({
      ok: true,
      recordCount: data.recordCount,
      fetchedAt: data.fetchedAt,
      performanceCache: isPerformanceSupabaseCacheEnabled() ? 'supabase-encrypted' : 'disk',
    })
  } catch (err) {
    console.error('[cron] warm-cache failed:', err)
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Cache warm failed',
    })
  }
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
    const data = await importGoalsFromCsv(csvText, {
      importedBy: req.user?.email ?? null,
    })
    res.json({
      goals: data.goals,
      columns: data.columns,
      columnMap: data.columnMap,
      importedAt: data.importedAt,
      source: data.source,
      goalCount: data.goals.length,
      importedBy: data.importedBy ?? null,
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
      const disk = isServerless() ? null : await readDiskCache()
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

app.get(
  '/api/employees',
  requireAuth,
  requirePerformanceApiAccess,
  async (req, res) => {
    try {
      const force = req.query.refresh === '1'
      if (force && isAuthEnabled() && !canForceRefresh(req.user?.role)) {
        return res.status(403).json({ error: 'Only HR or administrators can force a live refresh' })
      }

      if (!force && !isServerless() && memoryCache?.employeesDirectory?.length) {
        return res.json({
          employees: memoryCache.employeesDirectory,
          count: memoryCache.employeesDirectory.length,
          fetchedAt: memoryCache.fetchedAt,
          source: memoryCache.cacheStatus ?? 'memory',
          refreshing: Boolean(refreshInFlight),
        })
      }

      if (!force) {
        try {
          const fromSupabase = await loadEmployeesFromSupabase()
          if (fromSupabase?.employees.length) {
            if (memoryCache) {
              memoryCache.employeesDirectory = fromSupabase.employees
              memoryCache.fetchedAt = fromSupabase.fetchedAt ?? memoryCache.fetchedAt
            }
            return res.json({
              employees: fromSupabase.employees,
              count: fromSupabase.count,
              fetchedAt: fromSupabase.fetchedAt,
              source: fromSupabase.source,
              refreshing: Boolean(refreshInFlight),
            })
          }
        } catch (err) {
          console.warn('[employees] Supabase read failed:', err instanceof Error ? err.message : err)
        }
      }

      if (!force) {
        const persisted = await loadPersistedCache()
        if (persisted?.employeesDirectory?.length) {
          applyMemoryCache({
            ...persisted,
            employeesDirectory: persisted.employeesDirectory,
          })
          return res.json({
            employees: persisted.employeesDirectory,
            count: persisted.employeesDirectory.length,
            fetchedAt: persisted.fetchedAt,
            source: persisted.cacheStatus ?? 'disk',
            refreshing: Boolean(refreshInFlight),
          })
        }
      }

      const fetched = await fetchRevolutEmployeesList()
      if (memoryCache) {
        memoryCache.employeesDirectory = fetched.employeesDirectory
        memoryCache.employeesByEmail = {
          ...(memoryCache.employeesByEmail ?? {}),
          ...fetched.index,
        }
        memoryCache.fetchedAt = fetched.fetchedAt
      } else {
        memoryCache = {
          fetchedAt: fetched.fetchedAt,
          recordCount: 0,
          records: [],
          employeesByEmail: fetched.index,
          employeesDirectory: fetched.employeesDirectory,
          cacheStatus: 'live-employees',
        }
        memoryCacheAt = Date.now()
      }

      res.json({
        employees: fetched.employeesDirectory,
        count: fetched.count,
        fetchedAt: fetched.fetchedAt,
        source: 'revolut',
        refreshing: Boolean(refreshInFlight),
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load employees from Revolut',
      })
    }
  },
)

if (!isServerless() && fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

export function logStartupHints() {
  if (isAuthEnabled()) {
    console.log(`[auth] Google login enabled (default APP_URL=${defaultOrigin})`)
  } else {
    console.log('[auth] Disabled (VITE_BYPASS_AUTH=true or AUTH_DISABLED=true)')
  }
  const accessHint = getSupabaseConfigHint()
  if (accessHint) console.warn(`[access] ${accessHint}`)
  const perfHint = getPerformanceCacheConfigHint()
  if (perfHint) console.warn(`[cache] ${perfHint}`)
  console.log(`[access] Storage: ${accessStorageBackend()}`)
  console.log(`[permissions] Storage: ${getPermissionsCacheMeta().source}`)
  console.log(`[runtime] Platform: ${getPlatformLabel()}`)
  if (isSupabaseConfigured()) {
    console.log('[supabase] User access → dashboard_users table')
  }
  if (isPerformanceSupabaseCacheEnabled()) {
    console.log('[cache] Encrypted performance snapshot → performance_encrypted_cache')
  }
  if (isEmployeesSupabaseEnabled()) {
    console.log('[employees] Directory → employees table')
  }
}

export default app
