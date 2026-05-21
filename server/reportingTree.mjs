const MANAGER_ID_KEYS = [
  'Line Manager (HR profile) ID',
  'Line Manager (cycle) ID',
]

const EMPLOYEE_EMAIL_KEYS = ['Employee Email', 'Employee email', 'email']

function managerIdFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return null
  for (const key of MANAGER_ID_KEYS) {
    const value = payload[key]
    if (value != null && String(value).trim() !== '') {
      return String(value).trim()
    }
  }
  return null
}

function employeeEmailFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return null
  for (const key of EMPLOYEE_EMAIL_KEYS) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim().toLowerCase()
    }
  }
  return null
}

/**
 * Build line-manager edges from performance records (HR profile manager preferred per employee).
 * @param {Array<{ employee_id?: string | null, payload?: Record<string, unknown> }>} records
 */
export function buildReportingGraphFromRecords(records) {
  const reportsTo = new Map()
  const emailByEmployeeId = new Map()

  for (const record of records ?? []) {
    const employeeId =
      record.employee_id != null && String(record.employee_id).trim() !== ''
        ? String(record.employee_id).trim()
        : null
    if (!employeeId) continue

    const payload = record.payload ?? {}
    const email = employeeEmailFromPayload(payload)
    if (email) emailByEmployeeId.set(employeeId, email)

    const managerId = managerIdFromPayload(payload)
    if (!managerId) continue

    const existing = reportsTo.get(employeeId)
    const fromHrProfile = payload['Line Manager (HR profile) ID'] != null
    if (!existing || fromHrProfile) {
      reportsTo.set(employeeId, managerId)
    }
  }

  const directReports = new Map()
  for (const [employeeId, managerId] of reportsTo) {
    if (!directReports.has(managerId)) directReports.set(managerId, new Set())
    directReports.get(managerId).add(employeeId)
  }

  return { reportsTo, directReports, emailByEmployeeId }
}

/** All employee IDs in this manager's reporting subtree (direct + indirect). */
export function subtreeEmployeeIds(rootManagerId, directReports) {
  const result = new Set()
  if (!rootManagerId) return result

  const visiting = new Set()

  function walk(managerId) {
    if (visiting.has(managerId)) return
    visiting.add(managerId)
    for (const reportId of directReports.get(managerId) ?? []) {
      result.add(reportId)
      walk(reportId)
    }
    visiting.delete(managerId)
  }

  walk(String(rootManagerId))
  return result
}

/**
 * @param {{ email?: string, employeeId?: string | null }} user
 */
export function resolveManagerEmployeeId(user, emailByEmployeeId) {
  if (user.employeeId != null && String(user.employeeId).trim() !== '') {
    return String(user.employeeId).trim()
  }
  const emailKey = user.email?.trim().toLowerCase()
  if (!emailKey) return null
  for (const [employeeId, email] of emailByEmployeeId) {
    if (email === emailKey) return employeeId
  }
  return null
}
