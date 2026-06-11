import { apiFetch } from '@/lib/api'
import type { DataAccess, Role } from '@/lib/permissions'

export type AccessUser = {
  email: string
  role: Role
  name: string | null
  employeeId: string | null
  scopedDepartments: string[] | null
  addedAt: string | null
}

export type AccessRoleDefinition = {
  id: Role
  label: string
  description: string
  pages: string[]
  system: boolean
  manageUsers: boolean
  dataAccess: DataAccess
  uploadGoals: boolean
  forceRefresh: boolean
}

export type AccessConfigResponse = {
  storage?: 'supabase' | 'file'
  storageHint?: string | null
  users: AccessUser[]
  roles: AccessRoleDefinition[]
  pages: Record<string, { label: string; path: string }>
}

export type EmployeeLookupResult = {
  email: string
  found: boolean
  employeeId: string | null
  name: string | null
  source: 'revolut_directory' | 'performance_records' | null
}

export async function lookupEmployeeByEmail(email: string): Promise<EmployeeLookupResult> {
  const params = new URLSearchParams({ email: email.trim().toLowerCase() })
  const res = await apiFetch(`/api/access/employee-lookup?${params}`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Employee lookup failed (${res.status})`)
  }
  return res.json() as Promise<EmployeeLookupResult>
}

export async function fetchAccessConfig(): Promise<AccessConfigResponse> {
  const res = await apiFetch('/api/access')
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Access config failed (${res.status})`)
  }
  return res.json() as Promise<AccessConfigResponse>
}

export type DepartmentListResponse = {
  departments: string[]
  employeeCount: number
}

export async function fetchDepartmentOptions(): Promise<DepartmentListResponse> {
  const res = await apiFetch('/api/access/departments')
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Department list failed (${res.status})`)
  }
  return res.json() as Promise<DepartmentListResponse>
}

export type SyncRevolutUserResult = {
  email: string
  role: Role
  name: string | null
  employeeId: string | null
  directoryCount: number
  synced: boolean
  message: string
  revolutMatch: {
    employeeId: string
    name: string | null
    source: string
  } | null
}

export async function syncAccessUserWithRevolut(email: string): Promise<SyncRevolutUserResult> {
  const res = await apiFetch(
    `/api/access/users/${encodeURIComponent(email.trim().toLowerCase())}/sync-revolut`,
    { method: 'POST' },
  )
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Revolut sync failed (${res.status})`)
  }
  return res.json() as Promise<SyncRevolutUserResult>
}

export async function saveAccessUser(payload: {
  email: string
  role: Role
  name?: string
  employeeId?: string
  scopedDepartments?: string[] | null
}): Promise<void> {
  const res = await apiFetch('/api/access/users', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? 'Failed to save user')
  }
}

export type BulkImportResult = {
  added: number
  updated: number
  total: number
  users: AccessUser[]
}

export async function uploadAccessUsersCsv(csvText: string): Promise<BulkImportResult> {
  const res = await apiFetch('/api/access/users/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'text/csv' },
    body: csvText,
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string
      details?: string[]
    }
    const detail = body.details?.length ? `: ${body.details.join('; ')}` : ''
    throw new Error((body.error ?? 'Bulk import failed') + detail)
  }
  return res.json() as Promise<BulkImportResult>
}

export async function removeAccessUser(email: string): Promise<void> {
  const res = await apiFetch(`/api/access/users/${encodeURIComponent(email)}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? 'Failed to remove user')
  }
}
