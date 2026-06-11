import { loadPermissionsConfig } from './permissionsStore.mjs'
import {
  buildReportingGraphFromRecords,
  resolveManagerEmployeeId,
  subtreeEmployeeIds,
} from './reportingTree.mjs'
import {
  listRoleIds,
  isValidRoleId,
  normalizePermissionsConfig,
} from './permissionsValidation.mjs'

export { loadPermissionsConfig, getPermissionsCacheMeta } from './permissionsStore.mjs'

export function getRoleIds() {
  return listRoleIds(loadPermissionsConfig())
}

export function isValidRole(role) {
  return isValidRoleId(role) && Boolean(loadPermissionsConfig().roles[role])
}

export function getRoleDefinition(role) {
  return loadPermissionsConfig().roles[role] ?? null
}

export function isSystemRole(role) {
  return Boolean(getRoleDefinition(role)?.system)
}

export function roleHasPage(role, pageKey) {
  const config = loadPermissionsConfig()
  const roleConfig = config.roles[role]
  if (!roleConfig) return false
  if (roleConfig.pages.includes('*')) return true
  return roleConfig.pages.includes(pageKey)
}

/** Map URL pathname to a page key (longest prefix match). */
export function pageKeyFromPathname(pathname) {
  const config = loadPermissionsConfig()
  const normalized = pathname.replace(/\/$/, '') || '/'

  if (normalized.startsWith('/organization/people/') && normalized !== '/organization/people') {
    return 'organization.person'
  }
  if (normalized.startsWith('/performance/scorecards/')) {
    return 'performance.scorecard'
  }

  let bestMatch = null

  for (const [key, meta] of Object.entries(config.pages)) {
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

export function canAccessPath(role, pathname) {
  const pageKey = pageKeyFromPathname(pathname)
  if (!pageKey) return roleHasPage(role, 'home')
  return roleHasPage(role, pageKey)
}

export function listPagesForRole(role) {
  const config = loadPermissionsConfig()
  const roleConfig = config.roles[role]
  if (!roleConfig) return []
  if (roleConfig.pages.includes('*')) return Object.keys(config.pages)
  return roleConfig.pages
}

export function canManageAccess(role) {
  return Boolean(getRoleDefinition(role)?.manageUsers)
}

const PERFORMANCE_PAGE_KEYS = new Set([
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
])

export function canAccessPerformanceApi(role) {
  return [...PERFORMANCE_PAGE_KEYS].some((key) => roleHasPage(role, key))
}

export function canAccessEmployeesDirectory(role) {
  return (
    canAccessPerformanceApi(role) ||
    roleHasPage(role, 'goals') ||
    roleHasPage(role, 'goals.analytics')
  )
}

const MANAGER_EMAIL_KEYS = [
  'Line Manager (HR profile) Email',
  'Line Manager (cycle) Email',
]

function managerEmailFromRecord(record) {
  const payload = record.payload ?? {}
  for (const key of MANAGER_EMAIL_KEYS) {
    const v = payload[key]
    if (typeof v === 'string' && v.trim()) return v.trim().toLowerCase()
  }
  return null
}

function redactPayloadForExecutive(record) {
  const {
    employee_name,
    department,
    team,
    cycle_name,
    display_grade,
    line_manager_grade,
    calculated_grade,
    absolute_rating,
    ranking_score,
    employee_id,
    cycle_id,
    grade_record_id,
    id,
    synced_at,
  } = record
  return {
    ...record,
    payload: {
      'Employee Department': department,
      'Employee Team': team,
      'Cycle Name': cycle_name,
      'Display Grade': display_grade,
    },
    employee_name,
    department,
    team,
    cycle_name,
    display_grade,
    line_manager_grade,
    calculated_grade,
    absolute_rating,
    ranking_score,
    employee_id,
    cycle_id,
    grade_record_id,
    id,
    synced_at,
  }
}

function filterTeamRecords(records, user) {
  const { directReports, emailByEmployeeId } = buildReportingGraphFromRecords(records)
  const managerEmployeeId = resolveManagerEmployeeId(user, emailByEmployeeId)
  const subtreeIds = managerEmployeeId
    ? subtreeEmployeeIds(managerEmployeeId, directReports)
    : new Set()

  const emailKey = user.email?.toLowerCase()
  const managerIdStr =
    user.employeeId != null && String(user.employeeId).trim() !== ''
      ? String(user.employeeId).trim()
      : null

  return records.filter((record) => {
    const recordEmployeeId =
      record.employee_id != null && String(record.employee_id).trim() !== ''
        ? String(record.employee_id).trim()
        : null

    if (recordEmployeeId && subtreeIds.has(recordEmployeeId)) return true

    if (!managerEmployeeId) {
      const managerEmail = managerEmailFromRecord(record)
      if (emailKey && managerEmail && managerEmail === emailKey) return true
      if (managerIdStr && record.payload) {
        const lmId =
          record.payload['Line Manager (HR profile) ID'] ??
          record.payload['Line Manager (cycle) ID']
        if (lmId != null && String(lmId) === managerIdStr) return true
      }
    }

    return false
  })
}

/** Filter performance records based on role data access and logged-in user. */
export function filterRecordsForUser(records, user) {
  const def = getRoleDefinition(user.role)
  const dataAccess = def?.dataAccess ?? 'none'

  if (dataAccess === 'full') return records
  if (dataAccess === 'team') return filterTeamRecords(records, user)
  if (dataAccess === 'summary') return records.map(redactPayloadForExecutive)
  return []
}

export function canUploadGoals(role) {
  return Boolean(getRoleDefinition(role)?.uploadGoals)
}

export function canForceRefresh(role) {
  return Boolean(getRoleDefinition(role)?.forceRefresh)
}

export function rolesForAccessApi() {
  const config = loadPermissionsConfig()
  return Object.entries(config.roles).map(([id, def]) => ({
    id,
    label: def.label,
    description: def.description ?? '',
    pages: def.pages,
    system: Boolean(def.system),
    manageUsers: Boolean(def.manageUsers),
    dataAccess: def.dataAccess ?? 'full',
    uploadGoals: Boolean(def.uploadGoals),
    forceRefresh: Boolean(def.forceRefresh),
  }))
}

export { normalizePermissionsConfig, validatePermissionsConfig } from './permissionsValidation.mjs'
