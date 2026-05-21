import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { getSupabaseAdmin, isSupabaseConfigured } from './supabaseAdmin.mjs'
import { normalizePermissionsConfig } from './permissionsValidation.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PERMISSIONS_PATH = path.join(__dirname, '..', 'src', 'config', 'permissions.json')
const CONFIG_ID = 'default'

let cachedConfig = null
let cacheSource = 'file'

async function readFileConfig() {
  const raw = await fs.readFile(PERMISSIONS_PATH, 'utf8')
  return JSON.parse(raw)
}

async function readSupabaseConfig() {
  if (!isSupabaseConfigured()) return null
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('dashboard_permissions_config')
    .select('config')
    .eq('id', CONFIG_ID)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data?.config ?? null
}

export function getPermissionsCacheMeta() {
  return { source: cacheSource }
}

export async function initPermissionsConfig() {
  try {
    const fromDb = await readSupabaseConfig()
    if (fromDb?.pages && fromDb?.roles) {
      cachedConfig = normalizePermissionsConfig(fromDb)
      cacheSource = 'supabase'
      return
    }
  } catch (err) {
    console.warn('[permissions] Supabase load failed, using file:', err.message)
  }

  cachedConfig = normalizePermissionsConfig(await readFileConfig())
  cacheSource = 'file'
}

export function loadPermissionsConfig() {
  if (!cachedConfig) {
    throw new Error('Permissions not initialized — call initPermissionsConfig() on server start')
  }
  return cachedConfig
}

export async function savePermissionsConfig(config, validationOptions = {}) {
  const { validatePermissionsConfig } = await import('./permissionsValidation.mjs')
  const normalized = validatePermissionsConfig(config, validationOptions)

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('dashboard_permissions_config').upsert(
      {
        id: CONFIG_ID,
        config: normalized,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    if (error) throw new Error(error.message)
    cachedConfig = normalized
    cacheSource = 'supabase'
    return { source: 'supabase' }
  }

  await fs.writeFile(PERMISSIONS_PATH, JSON.stringify(normalized, null, 2), 'utf8')
  cachedConfig = normalized
  cacheSource = 'file'
  return { source: 'file' }
}

/** Seed Supabase from permissions.json when table is empty. */
export async function seedPermissionsConfigIfEmpty() {
  if (!isSupabaseConfigured()) return
  const existing = await readSupabaseConfig()
  if (existing) return
  const fileConfig = await readFileConfig()
  await savePermissionsConfig(fileConfig)
  console.log('[permissions] Seeded dashboard_permissions_config from permissions.json')
}
