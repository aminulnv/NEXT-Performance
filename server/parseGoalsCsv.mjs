import { parse } from 'csv-parse/sync'
import { createHash } from 'crypto'

const COLUMN_ALIASES = {
  employeeId: [
    'employee id',
    'reviewed employee id',
    'employee_id',
    'owner id',
    'assignee id',
    'user id',
  ],
  employeeName: [
    'employee',
    'employee name',
    'reviewed employee',
    'assignee',
    'name',
  ],
  owner: ['owner', 'owner email', 'assignee email'],
  ownerFullName: ['owner full name'],
  cycleName: ['review cycle', 'cycle name', 'goal cycle', 'cycle', 'period'],
  title: ['goal', 'goal title', 'title', 'objective', 'key result', 'goal name', 'okr'],
  status: ['goal status', 'status', 'state', 'progress status'],
  progress: ['progress', 'completion', 'completion %', 'completion percent', '% complete'],
  goalId: ['goal id', 'goal_id'],
  approvalStatus: ['approval status', 'approval'],
  organisationUnit: ['organisation unit', 'organization unit', 'org unit'],
  organisationName: ['organisation name', 'organization name', 'org name'],
  currentValue: ['current value', 'current'],
  initialValue: ['initial value', 'initial'],
  submittedAt: [
    'submitted date',
    'submission date',
    'submitted at',
    'goal submitted date',
    'date submitted',
  ],
  approvedAt: [
    'approval date',
    'approved date',
    'approved at',
    'date approved',
    'last approved date',
  ],
}

function normalizeHeader(header) {
  return String(header ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function pickColumn(headers, rows, aliases) {
  const normalized = headers.map(normalizeHeader)
  const aliasSet = new Set(aliases)
  const candidates = []

  for (let index = 0; index < headers.length; index += 1) {
    if (aliasSet.has(normalized[index])) {
      candidates.push(headers[index])
    }
  }

  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]

  // Prefer the column that actually contains values (e.g. "Review Cycle" over empty "Cycle").
  let bestHeader = candidates[0]
  let bestCount = -1
  for (const header of candidates) {
    let count = 0
    for (const row of rows) {
      const value = row[header]
      if (value != null && String(value).trim() !== '') count += 1
    }
    if (count > bestCount) {
      bestCount = count
      bestHeader = header
    }
  }
  return bestHeader
}

function rowId(row, index) {
  const key = [
    row.employee_id,
    row.employee_name,
    row.cycle_name,
    row.title,
    row.status,
    index,
  ]
    .filter(Boolean)
    .join('|')
  return createHash('sha256').update(key).digest('hex').slice(0, 16)
}

/**
 * Parse Revolut Goals CSV export into normalized records.
 * Unknown columns are kept on `fields` so the UI can show them before mapping is confirmed.
 */
export function parseGoalsCsv(csvText) {
  const trimmed = String(csvText ?? '').trim()
  if (!trimmed) {
    return { goals: [], columns: [], columnMap: {} }
  }

  const rows = parse(trimmed, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
    bom: true,
  })

  if (!rows.length) {
    return { goals: [], columns: [], columnMap: {} }
  }

  const headers = Object.keys(rows[0])
  const columnMap = {
    employeeId: pickColumn(headers, rows, COLUMN_ALIASES.employeeId),
    employeeName: pickColumn(headers, rows, COLUMN_ALIASES.employeeName),
    owner: pickColumn(headers, rows, COLUMN_ALIASES.owner),
    ownerFullName: pickColumn(headers, rows, COLUMN_ALIASES.ownerFullName),
    cycleName: pickColumn(headers, rows, COLUMN_ALIASES.cycleName),
    title: pickColumn(headers, rows, COLUMN_ALIASES.title),
    status: pickColumn(headers, rows, COLUMN_ALIASES.status),
    progress: pickColumn(headers, rows, COLUMN_ALIASES.progress),
    goalId: pickColumn(headers, rows, COLUMN_ALIASES.goalId),
    approvalStatus: pickColumn(headers, rows, COLUMN_ALIASES.approvalStatus),
    organisationUnit: pickColumn(headers, rows, COLUMN_ALIASES.organisationUnit),
    organisationName: pickColumn(headers, rows, COLUMN_ALIASES.organisationName),
    currentValue: pickColumn(headers, rows, COLUMN_ALIASES.currentValue),
    initialValue: pickColumn(headers, rows, COLUMN_ALIASES.initialValue),
    submittedAt: pickColumn(headers, rows, COLUMN_ALIASES.submittedAt),
    approvedAt: pickColumn(headers, rows, COLUMN_ALIASES.approvedAt),
  }

  const str = (value) => {
    if (value == null || value === '') return null
    return String(value).trim() || null
  }

  const goals = rows.map((raw, index) => {
    const fields = {}
    for (const [key, value] of Object.entries(raw)) {
      fields[key] = value == null ? '' : String(value)
    }

    const employee_id = str(columnMap.employeeId ? raw[columnMap.employeeId] : null)
    const owner = str(columnMap.owner ? raw[columnMap.owner] : null)
    const employee_name =
      str(columnMap.employeeName ? raw[columnMap.employeeName] : null) ??
      str(columnMap.ownerFullName ? raw[columnMap.ownerFullName] : null)
    const owner_full_name = str(
      columnMap.ownerFullName ? raw[columnMap.ownerFullName] : null,
    )
    const cycle_name = str(columnMap.cycleName ? raw[columnMap.cycleName] : null)
    const review_cycle = cycle_name
    const title = str(columnMap.title ? raw[columnMap.title] : null)
    const status = str(columnMap.status ? raw[columnMap.status] : null)
    const progress = str(columnMap.progress ? raw[columnMap.progress] : null)
    const goal_id = str(columnMap.goalId ? raw[columnMap.goalId] : null)
    const approval_status = str(
      columnMap.approvalStatus ? raw[columnMap.approvalStatus] : null,
    )
    const organisation_unit = str(
      columnMap.organisationUnit ? raw[columnMap.organisationUnit] : null,
    )
    const organisation_name = str(
      columnMap.organisationName ? raw[columnMap.organisationName] : null,
    )
    const current_value = str(columnMap.currentValue ? raw[columnMap.currentValue] : null)
    const initial_value = str(columnMap.initialValue ? raw[columnMap.initialValue] : null)
    const submitted_at = str(columnMap.submittedAt ? raw[columnMap.submittedAt] : null)
    const approved_at = str(columnMap.approvedAt ? raw[columnMap.approvedAt] : null)

    return {
      id: rowId({ employee_id, employee_name, cycle_name, title, status }, index),
      employee_id,
      employee_name,
      owner: owner ?? employee_id,
      owner_full_name,
      cycle_name,
      review_cycle,
      title,
      status,
      progress,
      goal_id,
      approval_status,
      organisation_unit,
      organisation_name,
      current_value,
      initial_value,
      submitted_at,
      approved_at,
      fields,
    }
  })

  return { goals, columns: headers, columnMap }
}
