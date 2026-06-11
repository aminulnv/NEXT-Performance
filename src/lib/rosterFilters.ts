import type { EmployeeDirectoryEntry } from '@/types/employee'

export type RosterFilterState = {
  departments: string[]
  teams: string[]
}

export function rosterTeamKey(employee: {
  department?: string | null
  team?: string | null
}): string | null {
  const team = employee.team?.trim()
  if (!team) return null
  const department = employee.department?.trim() || 'Unknown'
  return `${department}::${team}`
}

export function rosterTeamLabel(employee: {
  department?: string | null
  team?: string | null
}): string {
  const team = employee.team?.trim()
  if (!team) return ''
  const department = employee.department?.trim()
  return department ? `${team} · ${department}` : team
}

export function employeeMatchesRosterFilters(
  employee: EmployeeDirectoryEntry,
  filters: RosterFilterState,
  skip: { department?: boolean; team?: boolean } = {},
): boolean {
  if (!skip.department && filters.departments.length > 0) {
    const department = employee.department?.trim()
    if (!department || !filters.departments.includes(department)) return false
  }
  if (!skip.team && filters.teams.length > 0) {
    const teamKey = rosterTeamKey(employee)
    if (!teamKey || !filters.teams.includes(teamKey)) return false
  }
  return true
}

export function rosterForFilterOptions(
  roster: EmployeeDirectoryEntry[],
  filters: RosterFilterState,
  skip: { department?: boolean; team?: boolean } = {},
): EmployeeDirectoryEntry[] {
  const appliesOtherFilters =
    (!skip.department && filters.departments.length > 0) ||
    (!skip.team && filters.teams.length > 0)
  if (!appliesOtherFilters) return roster
  return roster.filter((employee) => employeeMatchesRosterFilters(employee, filters, skip))
}

export function departmentOptionsFromRoster(
  roster: EmployeeDirectoryEntry[],
  filters: RosterFilterState,
) {
  const optionsRoster = rosterForFilterOptions(roster, filters, { department: true })
  const departments = new Set<string>()
  for (const employee of optionsRoster) {
    const department = employee.department?.trim()
    if (department) departments.add(department)
  }
  return [...departments]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map((department) => ({ value: department, label: department }))
}

export function teamOptionsFromRoster(
  roster: EmployeeDirectoryEntry[],
  filters: RosterFilterState,
) {
  const optionsRoster = rosterForFilterOptions(roster, filters, { team: true })
  const teams = new Map<string, string>()
  for (const employee of optionsRoster) {
    const key = rosterTeamKey(employee)
    if (!key) continue
    teams.set(key, rosterTeamLabel(employee))
  }
  return [...teams.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
}

export type GoalRosterEntry = {
  department: string | null
  teamKey: string | null
}

export function buildGoalRosterIndex(employees: EmployeeDirectoryEntry[]) {
  const byEmployeeId = new Map<string, GoalRosterEntry>()
  const byEmail = new Map<string, GoalRosterEntry>()
  for (const employee of employees) {
    const entry: GoalRosterEntry = {
      department: employee.department?.trim() || null,
      teamKey: rosterTeamKey(employee),
    }
    byEmployeeId.set(employee.id, entry)
    const email = employee.email?.trim().toLowerCase()
    if (email) byEmail.set(email, entry)
  }
  return { byEmployeeId, byEmail }
}

export function resolveGoalRosterEntry(
  goal: { employee_id?: string | null; owner?: string | null },
  index: ReturnType<typeof buildGoalRosterIndex>,
): GoalRosterEntry | null {
  const employeeId = goal.employee_id?.trim()
  if (employeeId && index.byEmployeeId.has(employeeId)) {
    return index.byEmployeeId.get(employeeId) ?? null
  }
  const owner = goal.owner?.trim().toLowerCase()
  if (owner && index.byEmail.has(owner)) {
    return index.byEmail.get(owner) ?? null
  }
  return null
}

export function goalMatchesRosterFilters(
  goal: { employee_id?: string | null; owner?: string | null },
  index: ReturnType<typeof buildGoalRosterIndex>,
  filters: RosterFilterState,
): boolean {
  if (filters.departments.length === 0 && filters.teams.length === 0) return true
  const entry = resolveGoalRosterEntry(goal, index)
  if (!entry) return false
  if (filters.departments.length > 0) {
    if (!entry.department || !filters.departments.includes(entry.department)) return false
  }
  if (filters.teams.length > 0) {
    if (!entry.teamKey || !filters.teams.includes(entry.teamKey)) return false
  }
  return true
}
