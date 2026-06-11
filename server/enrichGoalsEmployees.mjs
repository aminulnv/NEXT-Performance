import {
  buildEmployeesByEmailFromList,
  lookupEmployeeByEmail,
  mergeRevolutEmployeesDirectory,
} from './employeeLookup.mjs'
import {
  isEmployeesSupabaseEnabled,
  loadEmployeesFromSupabase,
} from './employeesStoreSupabase.mjs'

/** Warm the email → employee id index from Supabase when the memory cache is cold. */
async function ensureEmployeeEmailIndex() {
  if (!isEmployeesSupabaseEnabled()) return
  try {
    const fromSupabase = await loadEmployeesFromSupabase()
    const employees = fromSupabase?.employees ?? []
    if (!employees.length) return
    const index = buildEmployeesByEmailFromList(
      employees.map((employee) => ({
        id: employee.id,
        email: employee.email,
        name: employee.name ?? employee.fullName,
      })),
    )
    mergeRevolutEmployeesDirectory(index)
  } catch (err) {
    console.warn(
      '[goals] Could not load employees for goal enrichment:',
      err instanceof Error ? err.message : err,
    )
  }
}

/** Fill missing employee_id from Owner email using the People directory. */
export async function enrichGoalsWithEmployeeIds(goals) {
  if (!goals?.length) return goals ?? []
  await ensureEmployeeEmailIndex()
  return goals.map((goal) => {
    if (goal.employee_id?.trim()) return goal
    const owner = goal.owner?.trim().toLowerCase()
    if (!owner?.includes('@')) return goal
    const match = lookupEmployeeByEmail(owner)
    if (!match?.id) return goal
    return {
      ...goal,
      employee_id: match.id,
      employee_name: goal.employee_name ?? match.name ?? goal.owner_full_name ?? null,
    }
  })
}
