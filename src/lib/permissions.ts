import permissionsJson from '@/config/permissions.json'

/** Role id (e.g. admin, hr, manager, or custom slugs you create in User management). */
export type Role = string

export type DataAccess = 'full' | 'team' | 'summary'

export type RoleDefinition = {
  label: string
  description?: string
  pages: string[]
  system?: boolean
  manageUsers?: boolean
  dataAccess?: DataAccess
  uploadGoals?: boolean
  forceRefresh?: boolean
}

export type PermissionsConfig = {
  pages: Record<string, { label: string; path: string }>
  roles: Record<Role, RoleDefinition>
}

const bundledConfig = permissionsJson as PermissionsConfig

let activeConfig: PermissionsConfig = bundledConfig

export function setActivePermissionsConfig(config: PermissionsConfig) {
  activeConfig = config
}

export function getPermissionsConfig(): PermissionsConfig {
  return activeConfig
}

export function getRoleIds(): Role[] {
  return Object.keys(activeConfig.roles)
}

export function getRoleDefinition(role: Role): RoleDefinition | undefined {
  return activeConfig.roles[role]
}

export function isSystemRole(role: Role): boolean {
  return Boolean(getRoleDefinition(role)?.system)
}

export function roleHasPage(role: Role, pageKey: string): boolean {
  const roleConfig = activeConfig.roles[role]
  if (!roleConfig) return false
  if (roleConfig.pages.includes('*')) return true
  return roleConfig.pages.includes(pageKey)
}

export function pageKeyFromPathname(pathname: string): string | null {
  const normalized = pathname.replace(/\/$/, '') || '/'

  if (
    normalized.startsWith('/organization/people/') &&
    normalized !== '/organization/people'
  ) {
    return 'organization.person'
  }
  if (normalized.startsWith('/performance/scorecards/')) {
    return 'performance.scorecard'
  }

  for (const [key, meta] of Object.entries(activeConfig.pages)) {
    const base = meta.path.replace(/\/$/, '') || '/'
    if (base.includes(':')) continue
    if (normalized === base || (base !== '/' && normalized.startsWith(`${base}/`))) {
      return key
    }
  }

  if (normalized === '/' || normalized === '') return 'home'
  return null
}

export function canAccessPath(role: Role, pathname: string): boolean {
  const pageKey = pageKeyFromPathname(pathname)
  if (!pageKey) return roleHasPage(role, 'home')
  return roleHasPage(role, pageKey)
}

export function listPagesForRole(role: Role) {
  const roleConfig = activeConfig.roles[role]
  if (!roleConfig) return []
  if (roleConfig.pages.includes('*')) return Object.keys(activeConfig.pages)
  return roleConfig.pages
}

export function canManageUsers(role: Role): boolean {
  return Boolean(getRoleDefinition(role)?.manageUsers)
}

export function canManageAccess(role: Role): boolean {
  return canManageUsers(role)
}

export function slugifyRoleId(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32)
}

export const DATA_ACCESS_LABELS: Record<DataAccess, string> = {
  full: 'All performance data',
  team: 'Reporting tree (direct + indirect reports)',
  summary: 'Summary only (redacted)',
}
