import { createClient } from '@supabase/supabase-js'

let client = null

export function isSupabaseConfigured() {
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  return Boolean(url && key)
}

export function getSupabaseConfigHint() {
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (url && !key) {
    return 'SUPABASE_URL is set but SUPABASE_SERVICE_ROLE_KEY is missing — users save to access.json until you add the key and restart the API.'
  }
  if (url && key) {
    return 'Supabase is configured but user access fell back to access.json — restart npm run dev after applying migrations, or check server logs for [access] errors.'
  }
  return null
}

export function getSupabaseAdmin() {
  if (!isSupabaseConfigured()) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env')
  }
  if (!client) {
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return client
}
