import { routes } from '@/lib/routes'

export type PeopleSearchParams = {
  department?: string
  cycle?: string
}

export function peopleUrl(filters: PeopleSearchParams = {}): string {
  const params = new URLSearchParams()
  if (filters.department) params.set('department', filters.department)
  if (filters.cycle) params.set('cycle', filters.cycle)
  const q = params.toString()
  return q ? `${routes.organization.people}?${q}` : routes.organization.people
}

export function readPeopleFilters(searchParams: URLSearchParams): PeopleSearchParams {
  return {
    department: searchParams.get('department') || undefined,
    cycle: searchParams.get('cycle') || undefined,
  }
}
