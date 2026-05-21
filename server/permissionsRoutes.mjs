import { loadPermissionsConfig, savePermissionsConfig, getPermissionsCacheMeta } from './permissionsStore.mjs'
import { requireAuth, requireRole } from './auth.mjs'
import { listUsers } from './accessStore.mjs'

export function registerPermissionsRoutes(app) {
  app.get('/api/permissions', requireAuth, (_req, res) => {
    try {
      const config = loadPermissionsConfig()
      res.json({
        ...config,
        source: getPermissionsCacheMeta().source,
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load permissions',
      })
    }
  })

  app.put('/api/permissions', requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const body = req.body
      if (!body?.pages || !body?.roles) {
        return res.status(400).json({ error: 'Body must include pages and roles' })
      }

      const previous = loadPermissionsConfig()
      const removedRoleIds = Object.keys(previous.roles).filter((id) => !body.roles[id])
      const users = await listUsers()
      const usersByRole = {}
      for (const u of users) {
        usersByRole[u.role] = (usersByRole[u.role] ?? 0) + 1
      }

      const result = await savePermissionsConfig(
        { pages: body.pages, roles: body.roles },
        { removedRoleIds, usersByRole },
      )
      res.json({ ok: true, source: result.source })
    } catch (err) {
      console.error(err)
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to save permissions',
      })
    }
  })
}
