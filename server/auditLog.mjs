import crypto from 'crypto'
import { getSupabaseAdmin, isSupabaseConfigured } from './supabaseAdmin.mjs'

export function clientIp(req) {
  if (!req) return null
  const forwarded = req.headers?.['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim()
  }
  return req.ip || req.socket?.remoteAddress || null
}

/** @param {import('express').Request} [req] */
export function auditActor(req) {
  const user = req?.user ?? req?.session?.user
  return {
    actorEmail: typeof user?.email === 'string' ? user.email.toLowerCase() : null,
    actorRole: typeof user?.role === 'string' ? user.role : null,
  }
}

export function buildAuditEntry({
  action,
  actorEmail = null,
  actorRole = null,
  target = null,
  metadata = null,
  req = null,
  requestId = crypto.randomUUID(),
}) {
  if (!action || typeof action !== 'string') {
    throw new Error('audit action is required')
  }

  const row = {
    request_id: requestId,
    action,
    actor_email: actorEmail,
    actor_role: actorRole,
    target,
    metadata: metadata && typeof metadata === 'object' ? metadata : null,
    ip_address: clientIp(req),
    user_agent: req?.get?.('user-agent') ?? null,
  }

  for (const key of Object.keys(row)) {
    if (row[key] == null) delete row[key]
  }

  return row
}

/**
 * Record a security audit event. Never throws — failures are logged only.
 * Persists to Supabase when configured; always emits a structured console line.
 */
export async function recordAuditEvent(event) {
  let entry
  try {
    entry = buildAuditEntry(event)
  } catch (err) {
    console.error('[audit] Invalid event:', err instanceof Error ? err.message : err)
    return
  }

  console.log('[audit]', JSON.stringify({ ...entry, created_at: new Date().toISOString() }))

  if (!isSupabaseConfigured()) return

  try {
    const { error } = await getSupabaseAdmin().from('audit_log').insert(entry)
    if (error) {
      console.error('[audit] Supabase insert failed:', error.message)
    }
  } catch (err) {
    console.error('[audit] Supabase insert failed:', err instanceof Error ? err.message : err)
  }
}

/** Fire-and-forget wrapper for route handlers. */
export function audit(event) {
  void recordAuditEvent(event)
}
