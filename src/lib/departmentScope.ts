/** Stored in scoped_departments — grants access to every department; other entries are kept for when this is removed. */
export const ALL_DEPARTMENTS_SCOPE = '*'

export const ALL_DEPARTMENTS_LABEL = 'All departments'

export function normalizeScopedDepartments(value: string[] | null | undefined): string[] | null {
  if (value == null || !Array.isArray(value)) return null
  const departments = [...new Set(value.map((d) => String(d).trim()).filter(Boolean))]
  if (departments.length === 0) return null

  const includesAll = departments.includes(ALL_DEPARTMENTS_SCOPE)
  const named = departments
    .filter((department) => department !== ALL_DEPARTMENTS_SCOPE)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

  if (includesAll) return [ALL_DEPARTMENTS_SCOPE, ...named]
  return named
}

export function namedScopedDepartments(scopedDepartments: string[] | null | undefined): string[] {
  const normalized = normalizeScopedDepartments(scopedDepartments)
  if (!normalized) return []
  return normalized.filter((department) => department !== ALL_DEPARTMENTS_SCOPE)
}

export function hasAllDepartmentsScope(scopedDepartments: string[] | null | undefined): boolean {
  return scopedDepartments?.includes(ALL_DEPARTMENTS_SCOPE) ?? false
}

/** True when HRBP has named department restrictions (not "all departments"). */
export function hasNamedDepartmentScope(scopedDepartments: string[] | null | undefined): boolean {
  const normalized = normalizeScopedDepartments(scopedDepartments)
  if (!normalized?.length) return false
  return !hasAllDepartmentsScope(normalized)
}

export function departmentScopeLabel(value: string): string {
  return value === ALL_DEPARTMENTS_SCOPE ? ALL_DEPARTMENTS_LABEL : value
}

export function isValidScopedDepartmentSelection(selected: string[]): boolean {
  const normalized = normalizeScopedDepartments(selected)
  return Boolean(normalized?.length)
}
