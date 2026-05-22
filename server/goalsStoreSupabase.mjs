import { getSupabaseAdmin } from './supabaseAdmin.mjs'

/** Ensure JSON from Supabase always has `fields` (older rows / bad test data may omit it). */
function normalizeGoalRecord(raw, index) {
  if (!raw || typeof raw !== 'object') return null
  const fields =
    raw.fields && typeof raw.fields === 'object' && !Array.isArray(raw.fields)
      ? raw.fields
      : {}
  return {
    id: raw.id ?? `goal-${index}`,
    employee_id: raw.employee_id ?? null,
    employee_name: raw.employee_name ?? null,
    owner: raw.owner ?? null,
    owner_full_name: raw.owner_full_name ?? null,
    cycle_name: raw.cycle_name ?? null,
    review_cycle: raw.review_cycle ?? null,
    title: raw.title ?? null,
    status: raw.status ?? null,
    progress: raw.progress ?? null,
    goal_id: raw.goal_id ?? null,
    approval_status: raw.approval_status ?? null,
    organisation_unit: raw.organisation_unit ?? null,
    organisation_name: raw.organisation_name ?? null,
    current_value: raw.current_value ?? null,
    initial_value: raw.initial_value ?? null,
    fields,
  }
}

function rowToDataset(row) {
  if (!row || !Array.isArray(row.goals)) return null
  const goals = row.goals
    .map((g, i) => normalizeGoalRecord(g, i))
    .filter(Boolean)
  return {
    goals,
    columns: row.columns ?? [],
    columnMap: row.column_map ?? {},
    importedAt: row.imported_at ?? null,
    source: row.source ?? 'upload',
    sourcePath: null,
    importedBy: row.imported_by ?? null,
  }
}

/** Latest CSV import shared by all API instances (replaces prior rows). */
export async function loadGoalsFromSupabase() {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('goals_imports')
    .select('imported_at, source, columns, column_map, goals, imported_by')
    .order('imported_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return rowToDataset(data)
}

export async function saveGoalsToSupabase(payload, { importedBy } = {}) {
  const supabase = getSupabaseAdmin()

  const { error: deleteError } = await supabase.from('goals_imports').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (deleteError) throw new Error(deleteError.message)

  const importedAt = payload.importedAt ?? new Date().toISOString()
  const { error: insertError } = await supabase.from('goals_imports').insert({
    imported_at: importedAt,
    source: payload.source ?? 'upload',
    goal_count: payload.goals.length,
    columns: payload.columns ?? [],
    column_map: payload.columnMap ?? {},
    goals: payload.goals,
    imported_by: importedBy ?? null,
  })

  if (insertError) throw new Error(insertError.message)
  return { ...payload, importedAt, importedBy: importedBy ?? null }
}
