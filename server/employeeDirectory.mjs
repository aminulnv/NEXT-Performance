const str = (v) => (v == null ? '' : String(v))

function trim(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function optionalString(value) {
  if (value == null || value === '') return null
  const text = String(value).trim()
  return text || null
}

function nestedValue(value, subKey = 'name') {
  if (value == null || value === '') return null
  if (typeof value === 'string') return trim(value) || null
  if (typeof value === 'object') return trim(value[subKey]) || null
  return optionalString(value)
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
  const fullName = optionalString(employee.full_name ?? employee.fullName)

  return {
    id,
    remoteId: employee.remote_id != null ? String(employee.remote_id) : null,
    name: employeeFullName(employee) || id,
    fullName,
    firstName: optionalString(employee.first_name),
    middleName: optionalString(employee.middle_name),
    lastName: optionalString(employee.last_name),
    email: employeeEmail(employee) || null,
    avatar: optionalString(employee.avatar),
    department: employeeDepartment(employee) || null,
    team: employeeTeam(employee) || null,
    location: nestedValue(employee.location),
    entity: nestedValue(employee.entity),
    joiningDateTime: optionalString(employee.joining_date_time),
    terminationDateTime: optionalString(employee.termination_date_time),
    updatedDateTime: optionalString(employee.updated_date_time),
    status: employeeStatus(employee) || null,
    inactivityReason: optionalString(employee.inactivity_reason),
    specialisation: nestedValue(employee.specialisation),
    seniority: nestedValue(employee.seniority),
    candidateId: employee.candidate_id != null ? String(employee.candidate_id) : null,
    lineManagerId: lineManager.id || null,
    lineManagerName: lineManager.name || null,
    lineManagerEmail: lineManager.email || null,
    profile: employee,
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
