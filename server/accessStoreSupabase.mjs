import { getSupabaseAdmin } from './supabaseAdmin.mjs'
import { isValidRole } from './permissions.mjs'
import { normalizeScopedDepartments } from './departmentScope.mjs'

function rowToEntry(row) {
  return {
    role: row.role,
    name: row.name ?? null,
    employeeId: row.employee_id ?? null,
    scopedDepartments: normalizeScopedDepartments(row.scoped_departments),
    addedAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  }
}

export async function listUsers() {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('dashboard_users')
    .select('email, role, name, employee_id, scoped_departments, created_at, updated_at')
    .order('email')

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    email: row.email,
    role: row.role,
    name: row.name,
    employeeId: row.employee_id,
    scopedDepartments: normalizeScopedDepartments(row.scoped_departments),
    addedAt: row.created_at,
  }))
}

export async function getUserAccess(email) {
  const key = email.toLowerCase()
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('dashboard_users')
    .select('email, role, name, employee_id, scoped_departments, created_at, updated_at')
    .eq('email', key)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return rowToEntry(data)
}

export async function upsertUser(email, { role, name, employeeId, scopedDepartments }) {
  const key = email.toLowerCase()
  if (!isValidRole(role)) {
    throw new Error(`Invalid role: ${role}`)
  }

  const supabase = getSupabaseAdmin()
  const row = {
    email: key,
    role,
    name: name ?? null,
    employee_id: employeeId ?? null,
  }
  if (scopedDepartments !== undefined) {
    row.scoped_departments = normalizeScopedDepartments(scopedDepartments)
  }

  const { data, error } = await supabase
    .from('dashboard_users')
    .upsert(row, { onConflict: 'email' })
    .select('email, role, name, employee_id, scoped_departments, created_at, updated_at')
    .single()

  if (error) throw new Error(error.message)
  return rowToEntry(data)
}

export async function removeUser(email) {
  const key = email.toLowerCase()
  const supabase = getSupabaseAdmin()
  const { error, count } = await supabase
    .from('dashboard_users')
    .delete({ count: 'exact' })
    .eq('email', key)

  if (error) throw new Error(error.message)
  return (count ?? 0) > 0
}

export async function bulkUpsertUsers(entries) {
  const supabase = getSupabaseAdmin()
  const emails = entries.map((e) => e.email.toLowerCase())

  const { data: existing } = await supabase
    .from('dashboard_users')
    .select('email')
    .in('email', emails)

  const existingSet = new Set((existing ?? []).map((r) => r.email))
  let added = 0
  let updated = 0

  const rows = entries.map((entry) => {
    if (existingSet.has(entry.email)) updated += 1
    else added += 1
    return {
      email: entry.email.toLowerCase(),
      role: entry.role,
      name: entry.name ?? null,
      employee_id: entry.employeeId ?? null,
    }
  })

  const { error } = await supabase.from('dashboard_users').upsert(rows, { onConflict: 'email' })
  if (error) throw new Error(error.message)

  return { added, updated, total: entries.length }
}
