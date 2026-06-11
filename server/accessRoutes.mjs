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
  app.get('/api/access', requireAuth, requireRole('admin'), async (_req, res) => {
    try {
      const users = await listUsers()
      const config = loadPermissionsConfig()
      res.json({
        storage: accessStorageBackend(),
        storageHint: getSupabaseConfigHint(),
        users,
        roles: rolesForAccessApi(),
        pages: config.pages,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load access config',
      })
    }
  })

  app.get('/api/access/departments', requireAuth, requireRole('admin'), async (_req, res) => {
    try {
      const employees = await resolveEmployeesDirectoryForAdmin()
      res.json({
        departments: uniqueDepartmentsFromEmployees(employees),
        employeeCount: employees.length,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load departments',
      })
    }
  })

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
    async (req, res) => {
      try {
        const email = decodeURIComponent(req.params.email || '').trim().toLowerCase()
        if (!email || !email.includes('@')) {
          return res.status(400).json({ error: 'Valid email is required' })
        }

        const existing = await getUserAccess(email)
        if (!existing) {
          return res.status(404).json({ error: 'User not found in access list' })
        }

        let directoryCount = 0
        let fetchedIndex = null
        try {
          const fetched = await fetchRevolutEmployeesByEmail()
          directoryCount = fetched.count
          fetchedIndex = fetched.index
        } catch (err) {
          console.error('[access] Revolut employees fetch failed:', err)
          return res.status(502).json({
            error:
              err instanceof Error
                ? err.message
                : 'Could not fetch employees from Revolut. Check REVOLUT_EMAIL and REVOLUT_TOKEN.',
          })
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
      } catch (err) {
        console.error(err)
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Revolut sync failed',
        })
      }
    },
  )

  app.put('/api/access/users', requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
      const role = typeof req.body?.role === 'string' ? req.body.role : ''
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email is required' })
      }
      const scopedDepartments = scopedDepartmentsForRole(
        role,
        req.body?.scopedDepartments,
      )
      if (role === 'hrbp' && !scopedDepartments?.length) {
        return res.status(400).json({
          error: 'HRBP users must have at least one assigned department',
        })
      }
      const entry = await upsertUser(email, {
        role,
        name: typeof req.body?.name === 'string' ? req.body.name : undefined,
        employeeId:
          typeof req.body?.employeeId === 'string' ? req.body.employeeId : undefined,
        scopedDepartments: role === 'hrbp' ? scopedDepartments : null,
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
      console.error(err)
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to save user',
      })
    }
  })

  app.post('/api/access/users/bulk', requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const csvText = typeof req.body === 'string' ? req.body : ''
      if (!csvText.trim()) {
        return res.status(400).json({
          error: 'Request body must be CSV text (Content-Type: text/csv)',
        })
      }
      const { users, errors } = parseAccessCsv(csvText)
      if (errors.length) {
        return res.status(400).json({ error: 'CSV validation failed', details: errors })
      }
      if (!users.length) {
        return res.status(400).json({ error: 'No users found in CSV' })
      }
      const result = await bulkUpsertUsers(users)
      const list = await listUsers()
      res.json({ ...result, users: list })
    } catch (err) {
      console.error(err)
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Bulk import failed',
      })
    }
  })

  app.delete('/api/access/users/:email', requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const email = decodeURIComponent(req.params.email || '')
      const removed = await removeUser(email)
      if (!removed) {
        return res.status(404).json({ error: 'User not found' })
      }
      res.json({ ok: true })
    } catch (err) {
      console.error(err)
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to remove user',
      })
    }
  })

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
