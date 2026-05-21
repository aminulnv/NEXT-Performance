const ROLE_ID_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/

const BUILTIN_DEFAULTS = {
  admin: {
    system: true,
    manageUsers: true,
    dataAccess: 'full',
    uploadGoals: true,
    forceRefresh: true,
  },
  hr: {
    system: true,
    dataAccess: 'full',
    uploadGoals: true,
    forceRefresh: true,
  },
  manager: {
    system: true,
    dataAccess: 'team',
  },
  executive: {
    system: true,
    dataAccess: 'summary',
  },
}

export function normalizeRoleDefinition(id, role) {
  const defaults = BUILTIN_DEFAULTS[id] ?? {
    dataAccess: 'full',
  }
  return {
    label: role?.label ?? id,
    description: role?.description ?? '',
    pages: Array.isArray(role?.pages) ? [...role.pages] : [],
    system: Boolean(role?.system ?? defaults.system),
    manageUsers: Boolean(role?.manageUsers ?? defaults.manageUsers),
    dataAccess: role?.dataAccess ?? defaults.dataAccess ?? 'full',
    uploadGoals: Boolean(role?.uploadGoals ?? defaults.uploadGoals),
    forceRefresh: Boolean(role?.forceRefresh ?? defaults.forceRefresh),
  }
}

export function normalizePermissionsConfig(config) {
  if (!config?.pages || !config?.roles) {
    throw new Error('Permissions config must include pages and roles')
  }

  const roles = {}
  for (const [id, role] of Object.entries(config.roles)) {
    roles[id] = normalizeRoleDefinition(id, role)
  }

  if (!roles.admin) {
    throw new Error('An administrator role (id: admin) is required')
  }

  roles.admin.pages = ['*']
  roles.admin.manageUsers = true
  roles.admin.system = true

  return {
    pages: config.pages,
    roles,
  }
}

export function listRoleIds(config) {
  return Object.keys(config.roles)
}

export function isValidRoleId(roleId) {
  return typeof roleId === 'string' && ROLE_ID_PATTERN.test(roleId)
}

export function validatePermissionsConfig(config, options = {}) {
  const errors = []
  const normalized = normalizePermissionsConfig(config)

  for (const id of Object.keys(normalized.roles)) {
    if (!isValidRoleId(id)) {
      errors.push(`Invalid role id "${id}" (use lowercase letters, numbers, hyphens)`)
    }
  }

  const admin = normalized.roles.admin
  if (!admin.manageUsers || !admin.pages.includes('*')) {
    errors.push('Administrator role must manage users and have all pages')
  }

  const manageUsersRoles = Object.entries(normalized.roles).filter(([, r]) => r.manageUsers)
  if (manageUsersRoles.length !== 1 || manageUsersRoles[0][0] !== 'admin') {
    errors.push('Only the admin role may manage users')
  }

  for (const [id, role] of Object.entries(normalized.roles)) {
    if (role.dataAccess && !['full', 'team', 'summary'].includes(role.dataAccess)) {
      errors.push(`Role "${id}" has invalid dataAccess`)
    }
    for (const pageKey of role.pages) {
      if (pageKey === '*') continue
      if (!normalized.pages[pageKey]) {
        errors.push(`Role "${id}" references unknown page "${pageKey}"`)
      }
    }
  }

  if (options.removedRoleIds?.length && options.usersByRole) {
    for (const roleId of options.removedRoleIds) {
      const count = options.usersByRole[roleId] ?? 0
      if (count > 0) {
        errors.push(`Cannot remove role "${roleId}" — ${count} user(s) still assigned`)
      }
    }
  }

  if (errors.length) {
    throw new Error(errors.join('; '))
  }

  return normalized
}

export function slugifyRoleId(label) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32)
}
