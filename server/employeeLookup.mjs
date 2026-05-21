/** Resolve Revolut employee id/name by work email from cached directory or performance records. */

function normalizeEmail(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function employeeDisplayName(employee) {
  if (!employee || typeof employee !== 'object') return ''
  const parts = [employee.first_name, employee.last_name].filter(Boolean)
  if (parts.length) return parts.join(' ')
  return (
    employee.full_name ??
    employee.name ??
    employee.display_name ??
    ''
  )
    .toString()
    .trim()
}

/** @param {unknown[]} employeesList */
export function buildEmployeesByEmailFromList(employeesList) {
  const index = {}
  for (const employee of employeesList ?? []) {
    if (!employee || typeof employee !== 'object') continue
    const id = employee.id != null ? String(employee.id) : ''
    if (!id) continue

    const emails = new Set()
    for (const field of ['email', 'work_email', 'workEmail']) {
      const normalized = normalizeEmail(employee[field])
      if (normalized) emails.add(normalized)
    }

    const entry = {
      id,
      name: employeeDisplayName(employee) || null,
    }

    for (const email of emails) {
      index[email] = entry
    }
  }
  return index
}

/** Fallback when cache predates employees directory — use flattened record payloads. */
export function buildEmployeesByEmailFromRecords(records) {
  const index = {}
  for (const record of records ?? []) {
    const payload = record.payload ?? {}
    const email = normalizeEmail(
      payload['Employee Email'] ?? payload['Employee email'] ?? payload.email,
    )
    const id =
      record.employee_id != null
        ? String(record.employee_id)
        : payload['Employee ID'] != null
          ? String(payload['Employee ID'])
          : ''
    if (!email || !id) continue
    if (!index[email]) {
      index[email] = {
        id,
        name: record.employee_name ?? payload.Employee ?? null,
      }
    }
  }
  return index
}

let getCacheSnapshot = null
let mergeEmployeesDirectory = null

export function registerEmployeeCacheAccessor(fn) {
  getCacheSnapshot = fn
}

export function registerEmployeesDirectoryMerger(fn) {
  mergeEmployeesDirectory = fn
}

/** Merge a live Revolut /employees fetch into the in-memory performance cache. */
export function mergeRevolutEmployeesDirectory(index) {
  mergeEmployeesDirectory?.(index)
}

function employeesIndexFromCache(cache) {
  if (!cache) return null
  if (cache.employeesByEmail && Object.keys(cache.employeesByEmail).length > 0) {
    return cache.employeesByEmail
  }
  if (cache.records?.length) {
    return buildEmployeesByEmailFromRecords(cache.records)
  }
  return null
}

/**
 * @param {string} email
 * @returns {{ id: string, name: string | null, source: 'revolut_directory' | 'performance_records' } | null}
 */
export function lookupEmployeeByEmail(email) {
  const key = normalizeEmail(email)
  if (!key || !key.includes('@')) return null

  const cache = getCacheSnapshot?.() ?? null
  const fromDirectory = cache?.employeesByEmail?.[key]
  if (fromDirectory?.id) {
    return { ...fromDirectory, source: 'revolut_directory' }
  }

  const derived = employeesIndexFromCache(cache)
  const fromRecords = derived?.[key]
  if (fromRecords?.id) {
    return { ...fromRecords, source: 'performance_records' }
  }

  return null
}

/**
 * Fill missing employeeId (and optionally name) from Revolut cache.
 * @param {string} email
 * @param {{ role: string, name?: string, employeeId?: string }} fields
 */
export function enrichAccessFieldsFromRevolut(email, fields, options = {}) {
  const lookup = lookupEmployeeByEmail(email)
  const manualId =
    fields.employeeId !== undefined && fields.employeeId !== null
      ? String(fields.employeeId).trim()
      : ''

  const employeeId = options.preferRevolut
    ? lookup?.id || manualId || undefined
    : manualId || lookup?.id || undefined

  const name = fields.name?.trim() || lookup?.name || undefined
  return {
    ...fields,
    ...(name ? { name } : {}),
    ...(employeeId ? { employeeId } : {}),
    revolutMatch: lookup
      ? { employeeId: lookup.id, name: lookup.name, source: lookup.source }
      : null,
  }
}
