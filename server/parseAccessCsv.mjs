import { parse } from 'csv-parse/sync'
import { isValidRole } from './permissions.mjs'

const EMAIL_HEADERS = ['email', 'e-mail', 'user email', 'work email']
const ROLE_HEADERS = ['role', 'access role', 'user role']
const NAME_HEADERS = ['name', 'full name', 'display name']
const EMPLOYEE_ID_HEADERS = ['employee_id', 'employee id', 'employeeid', 'revolut employee id']

function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function findColumn(columns, aliases) {
  for (const col of columns) {
    const key = normalizeHeader(col)
    if (aliases.includes(key)) return col
  }
  return null
}

/**
 * @param {string} csvText
 * @returns {{ users: { email: string, role: string, name?: string, employeeId?: string }[], errors: string[] }}
 */
export function parseAccessCsv(csvText) {
  const errors = []
  const trimmed = csvText.trim()
  if (!trimmed) {
    return { users: [], errors: ['CSV is empty'] }
  }

  let rows
  try {
    rows = parse(trimmed, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    })
  } catch (err) {
    return {
      users: [],
      errors: [err instanceof Error ? err.message : 'Failed to parse CSV'],
    }
  }

  if (!rows.length) {
    return { users: [], errors: ['No data rows in CSV'] }
  }

  const columns = Object.keys(rows[0])
  const emailCol = findColumn(columns, EMAIL_HEADERS)
  const roleCol = findColumn(columns, ROLE_HEADERS)

  if (!emailCol) {
    return { users: [], errors: ['CSV must include an "email" column'] }
  }
  if (!roleCol) {
    return { users: [], errors: ['CSV must include a "role" column'] }
  }

  const nameCol = findColumn(columns, NAME_HEADERS)
  const employeeIdCol = findColumn(columns, EMPLOYEE_ID_HEADERS)

  const users = []
  const seen = new Set()

  rows.forEach((row, index) => {
    const line = index + 2
    const email = String(row[emailCol] ?? '')
      .trim()
      .toLowerCase()
    const role = String(row[roleCol] ?? '').trim().toLowerCase()

    if (!email) {
      errors.push(`Row ${line}: missing email`)
      return
    }
    if (!email.includes('@')) {
      errors.push(`Row ${line}: invalid email "${email}"`)
      return
    }
    if (!role) {
      errors.push(`Row ${line}: missing role for ${email}`)
      return
    }
    if (!isValidRole(role)) {
      errors.push(`Row ${line}: invalid role "${role}" (use admin, hr, manager, executive)`)
      return
    }
    if (seen.has(email)) {
      errors.push(`Row ${line}: duplicate email ${email}`)
      return
    }
    seen.add(email)

    const entry = { email, role }
    if (nameCol && row[nameCol]) entry.name = String(row[nameCol]).trim()
    if (employeeIdCol && row[employeeIdCol]) {
      entry.employeeId = String(row[employeeIdCol]).trim()
    }
    users.push(entry)
  })

  return { users, errors }
}
