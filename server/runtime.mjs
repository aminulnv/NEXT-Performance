/** True on Vercel serverless (read-only filesystem except /tmp). */
export function isServerless() {
  return Boolean(process.env.VERCEL)
}

/** True when persistent storage must come from Supabase, not local disk. */
export function requiresSupabaseStorage() {
  return isServerless()
}

export function getPlatformLabel() {
  if (isServerless()) return 'vercel'
  return 'node'
}
