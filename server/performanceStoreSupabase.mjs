import { getSupabaseAdmin, isSupabaseConfigured } from './supabaseAdmin.mjs'
import { encryptJson, decryptJson, isEncryptionKeyConfigured } from './fieldCrypto.mjs'

const CACHE_ROW_ID = 'current'
const CHUNKS_TABLE = 'performance_encrypted_cache_chunks'
/** Base64 chars per chunk — keeps each PostgREST row well under the 8s timeout. */
const CHUNK_CHAR_SIZE = 120_000
const CHUNK_PAGE_SIZE = 30

function payloadForSupabase(cache) {
  return {
    fetchedAt: cache.fetchedAt,
    recordCount: cache.recordCount,
    records: cache.records,
    employeesByEmail: cache.employeesByEmail ?? null,
    // employeesDirectory lives in public.employees — omit to shrink the encrypted blob.
  }
}

async function fetchAllChunks(supabase, cacheId) {
  const parts = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from(CHUNKS_TABLE)
      .select('chunk_index, data')
      .eq('cache_id', cacheId)
      .order('chunk_index', { ascending: true })
      .range(offset, offset + CHUNK_PAGE_SIZE - 1)

    if (error) throw new Error(error.message)
    if (!data?.length) break

    parts.push(...data)
    if (data.length < CHUNK_PAGE_SIZE) break
    offset += CHUNK_PAGE_SIZE
  }

  if (!parts.length) return null

  parts.sort((left, right) => left.chunk_index - right.chunk_index)
  return parts.map((part) => part.data).join('')
}

async function replaceChunks(supabase, cacheId, ciphertext) {
  const { error: deleteError } = await supabase.from(CHUNKS_TABLE).delete().eq('cache_id', cacheId)
  if (deleteError) throw new Error(deleteError.message)

  if (!ciphertext) return

  const rows = []
  for (let index = 0, chunkIndex = 0; index < ciphertext.length; index += CHUNK_CHAR_SIZE, chunkIndex += 1) {
    rows.push({
      cache_id: cacheId,
      chunk_index: chunkIndex,
      data: ciphertext.slice(index, index + CHUNK_CHAR_SIZE),
    })
  }

  for (let offset = 0; offset < rows.length; offset += CHUNK_PAGE_SIZE) {
    const batch = rows.slice(offset, offset + CHUNK_PAGE_SIZE)
    const { error } = await supabase.from(CHUNKS_TABLE).insert(batch)
    if (error) throw new Error(error.message)
  }
}

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
    .select('synced_at, record_count, encryption_version, storage_format, ciphertext')
    .eq('id', CACHE_ROW_ID)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  let ciphertext = null
  if (data.storage_format === 'chunked') {
    ciphertext = await fetchAllChunks(supabase, CACHE_ROW_ID)
  } else {
    ciphertext = data.ciphertext ?? null
    if (!ciphertext) {
      ciphertext = await fetchAllChunks(supabase, CACHE_ROW_ID)
    }
  }

  if (!ciphertext) return null

  const decrypted = decryptJson({
    version: data.encryption_version ?? 1,
    ciphertext,
  })

  if (!decrypted?.records || !Array.isArray(decrypted.records)) {
    throw new Error('Encrypted cache payload is missing records array')
  }

  return {
    fetchedAt: data.synced_at ?? decrypted.fetchedAt,
    recordCount: data.record_count ?? decrypted.records.length,
    records: decrypted.records,
    employeesByEmail: decrypted.employeesByEmail ?? null,
    employeesDirectory: decrypted.employeesDirectory ?? null,
    cacheStatus: 'supabase',
  }
}

export async function savePerformanceCacheToSupabase(cache) {
  if (!isPerformanceSupabaseCacheEnabled()) return false

  const envelope = encryptJson(payloadForSupabase(cache))
  const supabase = getSupabaseAdmin()

  await replaceChunks(supabase, CACHE_ROW_ID, envelope.ciphertext)

  const { error } = await supabase.from('performance_encrypted_cache').upsert(
    {
      id: CACHE_ROW_ID,
      synced_at: cache.fetchedAt,
      record_count: cache.recordCount,
      encryption_version: envelope.version,
      storage_format: 'chunked',
      ciphertext: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )

  if (error) throw new Error(error.message)
  return true
}
