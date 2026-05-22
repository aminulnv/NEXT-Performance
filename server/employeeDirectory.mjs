const str = (v) => (v == null ? '' : String(v))

function trim(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function employeeFullName(employee) {
  if (!employee || typeof employee !== 'object') return ''
  if (trim(employee.full_name)) return trim(employee.full_name)
  if (trim(employee.fullName)) return trim(employee.fullName)
  const combined = [trim(employee.first_name), trim(employee.last_name)].filter(Boolean).join(' ')
  if (combined) return combined
  return trim(employee.name) || trim(employee.display_name)
}

function employeeDepartment(employee) {
  if (!employee) return ''
  if (trim(employee.department)) return trim(employee.department)
  return trim(employee?.team?.department?.name)
}

function employeeTeam(employee) {
  if (!employee) return ''
  const team = employee.team
  if (typeof team === 'string') return trim(team)
  if (team && typeof team === 'object') return trim(team.name)
  return ''
}

function employeeStatus(employee) {
  const status = employee?.status
  if (status == null || status === '') return ''
  if (typeof status === 'string') return trim(status)
  if (typeof status === 'object') {
    return trim(status.name ?? status.label ?? status.display_name ?? status.status ?? status.id ?? status.key)
  }
  return str(status)
}

function lineManagerFromProfile(employee) {
  const manager = employee?.line_manager
  if (!manager || typeof manager !== 'object') {
    return { id: '', name: '', email: '' }
  }
  const name =
    [trim(manager.first_name), trim(manager.last_name)].filter(Boolean).join(' ') ||
    trim(manager.full_name)
  return {
    id: str(manager.id),
    name,
    email: trim(manager.email),
  }
}

function employeeEmail(employee) {
  for (const field of ['email', 'work_email', 'workEmail']) {
    const value = trim(employee?.[field])
    if (value) return value.toLowerCase()
  }
  return ''
}

/** @param {unknown} employee */
export function normalizeEmployeeForDirectory(employee) {
  if (!employee || typeof employee !== 'object') return null
  const id = employee.id != null ? String(employee.id) : ''
  if (!id) return null

  const lineManager = lineManagerFromProfile(employee)
  return {
    id,
    remoteId: employee.remote_id != null ? String(employee.remote_id) : null,
    name: employeeFullName(employee) || id,
    email: employeeEmail(employee) || null,
    department: employeeDepartment(employee) || null,
    team: employeeTeam(employee) || null,
    status: employeeStatus(employee) || null,
    lineManagerId: lineManager.id || null,
    lineManagerName: lineManager.name || null,
    lineManagerEmail: lineManager.email || null,
  }
}

/** @param {unknown[]} employeesList */
export function normalizeEmployeesList(employeesList) {
  const rows = []
  const seen = new Set()

  for (const employee of employeesList ?? []) {
    const normalized = normalizeEmployeeForDirectory(employee)
    if (!normalized || seen.has(normalized.id)) continue
    seen.add(normalized.id)
    rows.push(normalized)
  }

  rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  return rows
}
