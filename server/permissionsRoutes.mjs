import { loadPermissionsConfig, savePermissionsConfig, getPermissionsCacheMeta } from './permissionsStore.mjs'
import { requireAuth, requireRole } from './auth.mjs'
import { listUsers } from './accessStore.mjs'
import { audit, auditActor } from './auditLog.mjs'
import { asyncHandler, HttpError, toHttpError } from './errors.mjs'

export function registerPermissionsRoutes(app) {
  app.get('/api/permissions', requireAuth, asyncHandler(async (_req, res) => {
    const config = loadPermissionsConfig()
    res.json({
      ...config,
      source: getPermissionsCacheMeta().source,
    })
  }))

  app.put('/api/permissions', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
    const body = req.body
    if (!body?.pages || !body?.roles) {
      throw new HttpError(400, 'Body must include pages and roles', { expose: true })
    }

    const previous = loadPermissionsConfig()
    const removedRoleIds = Object.keys(previous.roles).filter((id) => !body.roles[id])
    const users = await listUsers()
    const usersByRole = {}
    for (const u of users) {
      usersByRole[u.role] = (usersByRole[u.role] ?? 0) + 1
    }

    try {
      const result = await savePermissionsConfig(
        { pages: body.pages, roles: body.roles },
        { removedRoleIds, usersByRole },
      )
      audit({
        action: 'permissions.update',
        ...auditActor(req),
        metadata: {
          removedRoleIds,
          roleCount: Object.keys(body.roles).length,
          pageCount: Object.keys(body.pages).length,
          source: result.source,
        },
        req,
      })
      res.json({ ok: true, source: result.source })
    } catch (err) {
      throw toHttpError(err, 'Failed to save permissions', 400)
    }
  }))
}
