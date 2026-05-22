import { getSupabaseAdmin, isSupabaseConfigured } from './supabaseAdmin.mjs'

const SYNC_STATE_ID = 'current'
const UPSERT_BATCH_SIZE = 500

function rowFromEmployee(employee, syncedAt) {
  return {
    id: employee.id,
    remote_id: employee.remoteId ?? null,
    name: employee.name,
    email: employee.email ?? null,
    department: employee.department ?? null,
    team: employee.team ?? null,
    status: employee.status ?? null,
    line_manager_id: employee.lineManagerId ?? null,
    line_manager_name: employee.lineManagerName ?? null,
    line_manager_email: employee.lineManagerEmail ?? null,
    synced_at: syncedAt,
  }
}

function employeeFromRow(row) {
  return {
    id: row.id,
    remoteId: row.remote_id ?? null,
    name: row.name,
    email: row.email ?? null,
    department: row.department ?? null,
    team: row.team ?? null,
    status: row.status ?? null,
    lineManagerId: row.line_manager_id ?? null,
    lineManagerName: row.line_manager_name ?? null,
    lineManagerEmail: row.line_manager_email ?? null,
  }
}

export function isEmployeesSupabaseEnabled() {
  return isSupabaseConfigured()
}

export async function loadEmployeesFromSupabase() {
  if (!isEmployeesSupabaseEnabled()) return null

  const supabase = getSupabaseAdmin()
  const [{ data: syncState, error: syncError }, { data: rows, error: rowsError }] =
    await Promise.all([
      supabase
        .from('employees_sync_state')
        .select('synced_at, employee_count')
        .eq('id', SYNC_STATE_ID)
        .maybeSingle(),
      supabase
        .from('employees')
        .select(
          'id, remote_id, name, email, department, team, status, line_manager_id, line_manager_name, line_manager_email',
        )
        .order('name'),
    ])

  if (syncError) throw new Error(syncError.message)
  if (rowsError) throw new Error(rowsError.message)
  if (!rows?.length) return null

  return {
    employees: rows.map(employeeFromRow),
    count: rows.length,
    fetchedAt: syncState?.synced_at ?? null,
    source: 'supabase',
  }
}

export async function syncEmployeesToSupabase(employeesDirectory, syncedAt = new Date().toISOString()) {
  if (!isEmployeesSupabaseEnabled()) return false
  if (!Array.isArray(employeesDirectory) || employeesDirectory.length === 0) return false

  const supabase = getSupabaseAdmin()
  const rows = employeesDirectory.map((employee) => rowFromEmployee(employee, syncedAt))

  for (let index = 0; index < rows.length; index += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(index, index + UPSERT_BATCH_SIZE)
    const { error } = await supabase.from('employees').upsert(batch, { onConflict: 'id' })
    if (error) throw new Error(error.message)
  }

  const { error: deleteError } = await supabase
    .from('employees')
    .delete()
    .lt('synced_at', syncedAt)
  if (deleteError) throw new Error(deleteError.message)

  const { error: stateError } = await supabase.from('employees_sync_state').upsert(
    {
      id: SYNC_STATE_ID,
      synced_at: syncedAt,
      employee_count: employeesDirectory.length,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )
  if (stateError) throw new Error(stateError.message)

  return true
}
