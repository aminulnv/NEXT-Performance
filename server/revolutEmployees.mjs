import { getCredentials } from './buildCache.mjs'
import { revolutLogin, sleep } from './revolutHttp.mjs'
import { fetchAllPages } from './revolutData.mjs'
import { buildEmployeesByEmailFromList, mergeRevolutEmployeesDirectory } from './employeeLookup.mjs'
import { normalizeEmployeesList } from './employeeDirectory.mjs'
import { syncEmployeesToSupabase } from './employeesStoreSupabase.mjs'

async function loadEmployeesFromRevolut() {
  const { email, token } = getCredentials()
  const sessionToken = await revolutLogin(email, token)
  const list = await fetchAllPages(sessionToken, '/employees', {}, 20)
  await sleep(200)
  const fetchedAt = new Date().toISOString()
  const employeesDirectory = normalizeEmployeesList(list)
  const index = buildEmployeesByEmailFromList(list)
  mergeRevolutEmployeesDirectory(index)

  const syncedToSupabase = await syncEmployeesToSupabase(employeesDirectory, fetchedAt).catch(
    (err) => {
      console.warn('[employees] Supabase sync failed:', err instanceof Error ? err.message : err)
      return false
    },
  )
  if (syncedToSupabase) {
    console.log(`[employees] Synced ${employeesDirectory.length} rows to Supabase`)
  }

  return {
    employeesDirectory,
    index,
    count: employeesDirectory.length,
    fetchedAt,
  }
}

/** Live fetch of Revolut People directory (used for directory API and per-user sync). */
export async function fetchRevolutEmployeesList() {
  return loadEmployeesFromRevolut()
}

/** @deprecated alias for fetchRevolutEmployeesList */
export async function fetchRevolutEmployeesByEmail() {
  const fetched = await loadEmployeesFromRevolut()
  return {
    index: fetched.index,
    count: fetched.count,
  }
}
