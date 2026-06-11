import {
  listUsers,
  upsertUser,
  removeUser,
  bulkUpsertUsers,
  accessStorageBackend,
  getUserAccess,
} from './accessStore.mjs'
import { parseAccessCsv } from './parseAccessCsv.mjs'
import { loadPermissionsConfig, rolesForAccessApi } from './permissions.mjs'
import { requireAuth, requireRole, isAuthEnabled } from './auth.mjs'
import { getSupabaseConfigHint } from './supabaseAdmin.mjs'
import { csvUploadRateLimit } from './rateLimit.mjs'
import { audit, auditActor } from './auditLog.mjs'
import { asyncHandler, HttpError, toHttpError } from './errors.mjs'
import { isProductionRuntime } from './security.mjs'
import { getEmployeesDirectoryFromCache, lookupEmployeeByEmail, resolveEmployeeMatchFromIndex } from './employeeLookup.mjs'
import { fetchRevolutEmployeesByEmail } from './revolutEmployees.mjs'
import { loadEmployeesFromSupabase } from './employeesStoreSupabase.mjs'
import {
  normalizeScopedDepartments,
  uniqueDepartmentsFromEmployees,
} from './departmentScope.mjs'

async function resolveEmployeesDirectoryForAdmin() {
  const fromCache = getEmployeesDirectoryFromCache()
  if (fromCache.length) return fromCache
  try {
    const fromSupabase = await loadEmployeesFromSupabase()
    if (fromSupabase?.employees?.length) return fromSupabase.employees
  } catch (err) {
    console.warn('[access] Could not load employees for department list:', err)
  }
  return []
}

function scopedDepartmentsForRole(role, scopedDepartments) {
  if (role !== 'hrbp') return null
  return normalizeScopedDepartments(scopedDepartments)
}

export function registerAccessRoutes(app) {
  app.get('/api/access', requireAuth, requireRole('admin'), asyncHandler(async (_req, res) => {
    const users = await listUsers()
    const config = loadPermissionsConfig()
    res.json({
      storage: accessStorageBackend(),
      storageHint: getSupabaseConfigHint(),
      users,
      roles: rolesForAccessApi(),
      pages: config.pages,
    })
  }))

  app.get('/api/access/departments', requireAuth, requireRole('admin'), asyncHandler(async (_req, res) => {
    const employees = await resolveEmployeesDirectoryForAdmin()
    res.json({
      departments: uniqueDepartmentsFromEmployees(employees),
      employeeCount: employees.length,
    })
  }))

  app.get('/api/access/employee-lookup', requireAuth, requireRole('admin'), (req, res) => {
    const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : ''
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email query parameter is required' })
    }
    const match = lookupEmployeeByEmail(email)
    res.json({
      email,
      found: Boolean(match),
      employeeId: match?.id ?? null,
      name: match?.name ?? null,
      source: match?.source ?? null,
    })
  })

  app.post(
    '/api/access/users/:email/sync-revolut',
    requireAuth,
    requireRole('admin'),
    asyncHandler(async (req, res) => {
      const email = decodeURIComponent(req.params.email || '').trim().toLowerCase()
      if (!email || !email.includes('@')) {
        throw new HttpError(400, 'Valid email is required', { expose: true })
      }

      const existing = await getUserAccess(email)
      if (!existing) {
        throw new HttpError(404, 'User not found in access list', { expose: true })
      }

      let directoryCount = 0
      let fetchedIndex = null
      try {
        const fetched = await fetchRevolutEmployeesByEmail()
        directoryCount = fetched.count
        fetchedIndex = fetched.index
      } catch (err) {
        throw new HttpError(
          502,
          'Could not fetch employees from Revolut. Check REVOLUT_EMAIL and REVOLUT_TOKEN.',
          { expose: true, details: isProductionRuntime() ? undefined : err instanceof Error ? err.message : err },
        )
      }

      const match =
        resolveEmployeeMatchFromIndex(email, fetchedIndex) ?? lookupEmployeeByEmail(email)
      const entry = await upsertUser(
        email,
        {
          role: existing.role,
          name: match?.name ?? existing.name ?? undefined,
          employeeId: match?.id ?? existing.employeeId ?? undefined,
          scopedDepartments: existing.scopedDepartments ?? undefined,
        },
        { preferRevolut: true },
      )

      audit({
        action: 'access.user.sync_revolut',
        ...auditActor(req),
        target: email,
        metadata: {
          synced: Boolean(match?.id),
          employeeId: match?.id ?? null,
          directoryCount,
        },
        req,
      })

      res.json({
        email,
        ...entry,
        directoryCount,
        revolutMatch: match
          ? { employeeId: match.id, name: match.name, source: match.source }
          : null,
        synced: Boolean(match?.id),
        message: match?.id
          ? `Matched Revolut employee ${match.id}`
          : 'No Revolut employee found for this email. You can set the ID manually.',
      })
    }),
  )

  app.put('/api/access/users', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const role = typeof req.body?.role === 'string' ? req.body.role : ''
    if (!email || !email.includes('@')) {
      throw new HttpError(400, 'Valid email is required', { expose: true })
    }
    const scopedDepartments = scopedDepartmentsForRole(
      role,
      req.body?.scopedDepartments,
    )
    if (role === 'hrbp' && !scopedDepartments?.length) {
      throw new HttpError(400, 'HRBP users must have at least one assigned department', {
        expose: true,
      })
    }
    try {
      const prior = await getUserAccess(email)
      const entry = await upsertUser(email, {
        role,
        name: typeof req.body?.name === 'string' ? req.body.name : undefined,
        employeeId:
          typeof req.body?.employeeId === 'string' ? req.body.employeeId : undefined,
        scopedDepartments: role === 'hrbp' ? scopedDepartments : null,
      })
      audit({
        action: prior ? 'access.user.update' : 'access.user.create',
        ...auditActor(req),
        target: email,
        metadata: {
          role,
          priorRole: prior?.role ?? null,
          employeeId: entry.employeeId ?? null,
          scopedDepartments: entry.scopedDepartments ?? null,
        },
        req,
      })
      const match = lookupEmployeeByEmail(email)
      res.json({
        email,
        ...entry,
        revolutMatch: match
          ? { employeeId: match.id, name: match.name, source: match.source }
          : null,
      })
    } catch (err) {
      throw toHttpError(err, 'Failed to save user', 400)
    }
  }))

  app.post(
    '/api/access/users/bulk',
    requireAuth,
    requireRole('admin'),
    csvUploadRateLimit,
    asyncHandler(async (req, res) => {
      const csvText = typeof req.body === 'string' ? req.body : ''
      if (!csvText.trim()) {
        throw new HttpError(400, 'Request body must be CSV text (Content-Type: text/csv)', {
          expose: true,
        })
      }
      const { users, errors } = parseAccessCsv(csvText)
      if (errors.length) {
        throw new HttpError(400, 'CSV validation failed', { expose: true, details: errors })
      }
      if (!users.length) {
        throw new HttpError(400, 'No users found in CSV', { expose: true })
      }
      const result = await bulkUpsertUsers(users)
      const list = await listUsers()
      audit({
        action: 'access.user.bulk_import',
        ...auditActor(req),
        metadata: {
          added: result.added,
          updated: result.updated,
          total: result.total,
        },
        req,
      })
      res.json({ ...result, users: list })
    }),
  )

  app.delete(
    '/api/access/users/:email',
    requireAuth,
    requireRole('admin'),
    asyncHandler(async (req, res) => {
      const email = decodeURIComponent(req.params.email || '')
      const removed = await removeUser(email)
      if (!removed) {
        throw new HttpError(404, 'User not found', { expose: true })
      }
      audit({
        action: 'access.user.delete',
        ...auditActor(req),
        target: email.toLowerCase(),
        req,
      })
      res.json({ ok: true })
    }),
  )

  app.get('/api/access/public-config', (_req, res) => {
    if (!isAuthEnabled()) {
      return res.json({ authEnabled: false })
    }
    const config = loadPermissionsConfig()
    res.json({
      authEnabled: true,
      roles: Object.fromEntries(
        Object.entries(config.roles).map(([id, def]) => [
          id,
          { label: def.label, pages: def.pages },
        ]),
      ),
      pages: config.pages,
    })
  })
}
