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

  let bestMatch: { key: string; baseLength: number } | null = null

  for (const [key, meta] of Object.entries(activeConfig.pages)) {
    const base = meta.path.replace(/\/$/, '') || '/'
    if (base.includes(':')) continue
    const matches =
      normalized === base || (base !== '/' && normalized.startsWith(`${base}/`))
    if (matches && (!bestMatch || base.length > bestMatch.baseLength)) {
      bestMatch = { key, baseLength: base.length }
    }
  }

  if (bestMatch) return bestMatch.key

  if (normalized === '/' || normalized === '') return 'home'
  return null
}

export function canAccessPath(role: Role, pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, '') || '/'
  const pageKey = pageKeyFromPathname(pathname)
  if (pageKey) return roleHasPage(role, pageKey)

  if (normalized === '/' || normalized === '') {
    return roleHasPage(role, 'home')
  }

  const section = sectionRootFromPathname(pathname)
  if (section && normalized === section) {
    return firstAccessiblePathInSection(role, section) != null
  }

  return false
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

const PERFORMANCE_DATA_PAGE_KEYS = [
  'home',
  'organization.departments',
  'organization.people',
  'organization.person',
  'performance.records',
  'performance.cycles',
  'performance.scorecard',
  'performance.analytics',
  'performance.explore',
  'performance.reviewers',
  'performance.calibration',
] as const

export function canAccessPerformanceData(role: Role): boolean {
  return PERFORMANCE_DATA_PAGE_KEYS.some((key) => roleHasPage(role, key))
}

export function canAccessEmployeesDirectory(role: Role): boolean {
  return (
    canAccessPerformanceData(role) ||
    roleHasPage(role, 'goals') ||
    roleHasPage(role, 'goals.analytics')
  )
}

/** Roles that restrict data to assigned departments when scopedDepartments is set. */
export function roleUsesDepartmentScope(role: Role): boolean {
  return role === 'hrbp'
}

const LANDING_PAGE_KEYS = [
  'goals.analytics',
  'home',
  'performance.records',
  'organization.departments',
  'account.profile',
] as const

/** Nav order within each top-level section (matches layout.ts). */
export const SECTION_PAGE_ORDER: Record<string, readonly string[]> = {
  '/organization': ['organization.departments', 'organization.people'],
  '/performance': [
    'performance.analytics',
    'performance.records',
    'performance.cycles',
    'performance.explore',
    'performance.reviewers',
    'performance.calibration',
  ],
  '/goals': ['goals.analytics', 'goals'],
  '/admin': ['admin.settings', 'admin.dataHealth', 'admin.access'],
}

export function sectionRootFromPathname(pathname: string): string | null {
  const normalized = pathname.replace(/\/$/, '') || '/'
  if (normalized === '/' || normalized === '') return null
  for (const root of Object.keys(SECTION_PAGE_ORDER)) {
    if (normalized === root || normalized.startsWith(`${root}/`)) return root
  }
  return null
}

/** First page the role can open within a section (e.g. /performance → /performance/cycles). */
export function firstAccessiblePathInSection(role: Role, sectionPrefix: string): string | null {
  const root = sectionPrefix.replace(/\/$/, '') || '/'
  const orderedKeys = SECTION_PAGE_ORDER[root]
  if (orderedKeys) {
    for (const pageKey of orderedKeys) {
      if (roleHasPage(role, pageKey)) {
        const path = activeConfig.pages[pageKey]?.path
        if (path && !path.includes(':')) return path
      }
    }
  }

  for (const pageKey of listPagesForRole(role)) {
    const path = activeConfig.pages[pageKey]?.path
    if (!path || path.includes(':')) continue
    const normalizedPath = path.replace(/\/$/, '') || '/'
    if (normalizedPath === root || normalizedPath.startsWith(`${root}/`)) {
      return path
    }
  }

  return null
}

/** First route the role can open — used when landing on an unauthorized path. */
export function firstAccessiblePath(role: Role): string | null {
  if (!getRoleDefinition(role)) return null

  for (const pageKey of LANDING_PAGE_KEYS) {
    if (roleHasPage(role, pageKey)) {
      const path = activeConfig.pages[pageKey]?.path
      if (path && !path.includes(':')) return path
    }
  }

  for (const pageKey of listPagesForRole(role)) {
    const path = activeConfig.pages[pageKey]?.path
    if (path && !path.includes(':')) return path
  }

  return null
}

/** Prefer a sibling page in the same section before sending the user elsewhere. */
export function redirectPathForUnauthorized(role: Role, pathname: string): string | null {
  const normalized = pathname.replace(/\/$/, '') || '/'
  const section = sectionRootFromPathname(pathname)
  if (section) {
    const inSection = firstAccessiblePathInSection(role, section)
    if (inSection) {
      const target = inSection.replace(/\/$/, '') || '/'
      if (target !== normalized) return inSection
    }
  }

  const global = firstAccessiblePath(role)
  if (!global) return null
  const globalNorm = global.replace(/\/$/, '') || '/'
  if (globalNorm !== normalized) return global
  return null
}
