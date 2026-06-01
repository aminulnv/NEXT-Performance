import { routes } from '@/lib/routes'

export type GoalsSearchParams = {
  employee?: string
  owner?: string
  search?: string
}

export function employeeGoalsUrl(opts: {
  employeeId?: string | null
  owner?: string | null
}): string | null {
  const employeeId = opts.employeeId?.trim()
  if (employeeId) {
    return `${routes.goals.root}?${new URLSearchParams({ employee: employeeId })}`
  }
  const owner = opts.owner?.trim()
  if (owner) {
    return `${routes.goals.root}?${new URLSearchParams({ owner })}`
  }
  return null
}

/** Open Goals with the search box prefilled (e.g. from Monitoring person rows). */
export function personGoalsSearchUrl(name: string): string | null {
  const query = name.trim()
  if (!query) return null
  return `${routes.goals.root}?${new URLSearchParams({ search: query })}`
}

export function readGoalsFilters(searchParams: URLSearchParams): GoalsSearchParams {
  const employee = searchParams.get('employee')?.trim()
  const owner = searchParams.get('owner')?.trim()
  const search = searchParams.get('search')?.trim()
  return {
    employee: employee || undefined,
    owner: owner || undefined,
    search: search || undefined,
  }
}

export function clearEmployeeGoalsParams(searchParams: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(searchParams)
  next.delete('employee')
  next.delete('owner')
  next.delete('search')
  return next
}
