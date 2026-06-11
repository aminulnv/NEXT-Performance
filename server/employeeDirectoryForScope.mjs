import { getEmployeesDirectoryFromCache } from './employeeLookup.mjs'
import {
  isEmployeesSupabaseEnabled,
  loadEmployeesFromSupabase,
} from './employeesStoreSupabase.mjs'

/** People directory for HRBP department scoping — falls back to Supabase when memory cache is cold. */
export async function resolveEmployeesDirectoryForScope() {
  const cached = getEmployeesDirectoryFromCache()
  if (cached.length) return cached

  if (!isEmployeesSupabaseEnabled()) return []

  try {
    const fromSupabase = await loadEmployeesFromSupabase()
    return fromSupabase?.employees ?? []
  } catch (err) {
    console.warn(
      '[goals] Could not load employees for scope filtering:',
      err instanceof Error ? err.message : err,
    )
    return []
  }
}
