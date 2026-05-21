import { apiFetch } from '@/lib/api'
import type { Role } from '@/lib/permissions'

export type AuthUser = {
  id: string
  email: string
  name: string
  picture: string | null
  role: Role
  employeeId: string | null
  roleLabel: string
}

export type AuthMeResponse =
  | { authenticated: false }
  | {
      authenticated: true
      user: AuthUser
      permissions: { pages: string[] }
    }

export async function fetchAuthMe(): Promise<AuthMeResponse> {
  const res = await apiFetch('/api/auth/me')
  if (res.status === 401) {
    return { authenticated: false }
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Auth check failed (${res.status})`)
  }
  return res.json() as Promise<AuthMeResponse>
}

export function googleLoginUrl(returnTo?: string): string {
  const params = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''
  return `/api/auth/google${params}`
}

export async function logout(): Promise<void> {
  const res = await apiFetch('/api/auth/logout', { method: 'POST' })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? 'Logout failed')
  }
}
