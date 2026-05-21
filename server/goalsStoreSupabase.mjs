import { getSupabaseAdmin } from './supabaseAdmin.mjs'

function rowToDataset(row) {
  if (!row || !Array.isArray(row.goals)) return null
  return {
    goals: row.goals,
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
