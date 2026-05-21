import { getSupabaseAdmin, isSupabaseConfigured } from './supabaseAdmin.mjs'
import { encryptJson, decryptJson, isEncryptionKeyConfigured } from './fieldCrypto.mjs'

const CACHE_ROW_ID = 'current'

export function isPerformanceSupabaseCacheEnabled() {
  return isSupabaseConfigured() && isEncryptionKeyConfigured()
}

export function getPerformanceCacheConfigHint() {
  if (!isSupabaseConfigured()) return null
  if (!isEncryptionKeyConfigured()) {
    return 'Supabase is set but PERFORMANCE_DATA_ENCRYPTION_KEY is missing — performance data stays on disk only.'
  }
  return null
}

export async function loadPerformanceCacheFromSupabase() {
  if (!isPerformanceSupabaseCacheEnabled()) return null

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('performance_encrypted_cache')
    .select('synced_at, record_count, encryption_version, ciphertext')
    .eq('id', CACHE_ROW_ID)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data?.ciphertext) return null

  const decrypted = decryptJson({
    version: data.encryption_version ?? 1,
    ciphertext: data.ciphertext,
  })

  if (!decrypted?.records || !Array.isArray(decrypted.records)) {
    throw new Error('Encrypted cache payload is missing records array')
  }

  return {
    fetchedAt: data.synced_at ?? decrypted.fetchedAt,
    recordCount: data.record_count ?? decrypted.records.length,
    records: decrypted.records,
    employeesByEmail: decrypted.employeesByEmail ?? null,
    cacheStatus: 'supabase',
  }
}

export async function savePerformanceCacheToSupabase(cache) {
  if (!isPerformanceSupabaseCacheEnabled()) return false

  const envelope = encryptJson({
    fetchedAt: cache.fetchedAt,
    recordCount: cache.recordCount,
    records: cache.records,
    employeesByEmail: cache.employeesByEmail ?? null,
  })

  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('performance_encrypted_cache').upsert(
    {
      id: CACHE_ROW_ID,
      synced_at: cache.fetchedAt,
      record_count: cache.recordCount,
      encryption_version: envelope.version,
      ciphertext: envelope.ciphertext,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )

  if (error) throw new Error(error.message)
  return true
}
