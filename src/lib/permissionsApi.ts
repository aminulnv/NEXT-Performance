import { apiFetch } from '@/lib/api'
import type { PermissionsConfig } from '@/lib/permissions'

export type PermissionsResponse = PermissionsConfig & {
  source?: 'supabase' | 'file'
}

export async function fetchPermissions(): Promise<PermissionsResponse> {
  const res = await apiFetch('/api/permissions')
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Permissions failed (${res.status})`)
  }
  return res.json() as Promise<PermissionsResponse>
}

export async function savePermissions(
  config: PermissionsConfig,
): Promise<{ ok: boolean; source: string }> {
  const res = await apiFetch('/api/permissions', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? 'Failed to save permissions')
  }
  return res.json() as Promise<{ ok: boolean; source: string }>
}
