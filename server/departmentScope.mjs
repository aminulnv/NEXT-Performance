/** Roles that enforce scoped_departments when the array is non-empty. */
const DEPARTMENT_SCOPED_ROLES = new Set(['hrbp'])

export function normalizeScopedDepartments(value) {
  if (value == null) return null
  if (!Array.isArray(value)) return null
  const departments = [...new Set(value.map((d) => String(d).trim()).filter(Boolean))]
  return departments.length > 0 ? departments.sort((a, b) => a.localeCompare(b)) : null
}

export function getDepartmentScope(user) {
  if (!user?.role || !DEPARTMENT_SCOPED_ROLES.has(user.role)) return null
  return normalizeScopedDepartments(user.scopedDepartments)
}

export function filterEmployeesByDepartmentScope(employees, scope) {
  if (!scope?.length) return employees
  const allowed = new Set(scope)
  return employees.filter((employee) => {
    const department = employee.department?.trim()
    return department && allowed.has(department)
  })
}

export function filterEmployeesForUser(employees, user) {
  return filterEmployeesByDepartmentScope(employees, getDepartmentScope(user))
}

export function filterGoalsByDepartmentScope(goals, employees, scope) {
  if (!scope?.length) return goals
  const scopedEmployees = filterEmployeesByDepartmentScope(employees, scope)
  const employeeIds = new Set()
  const ownerEmails = new Set()
  for (const employee of scopedEmployees) {
    employeeIds.add(employee.id)
    const email = employee.email?.trim().toLowerCase()
    if (email) ownerEmails.add(email)
  }
  return goals.filter((goal) => {
    const employeeId = goal.employee_id?.trim()
    if (employeeId && employeeIds.has(employeeId)) return true
    const owner = goal.owner?.trim().toLowerCase()
    return owner ? ownerEmails.has(owner) : false
  })
}

export function filterGoalsForUser(goals, employees, user) {
  return filterGoalsByDepartmentScope(goals, employees, getDepartmentScope(user))
}

export function uniqueDepartmentsFromEmployees(employees) {
  const departments = new Set()
  for (const employee of employees ?? []) {
    const department = employee.department?.trim()
    if (department) departments.add(department)
  }
  return [...departments].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}
