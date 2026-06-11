import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { isValidRole } from './permissions.mjs'
import { enrichAccessFieldsFromRevolut } from './employeeLookup.mjs'
import { isSupabaseConfigured } from './supabaseAdmin.mjs'
import { normalizeScopedDepartments } from './departmentScope.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ACCESS_FILE = path.join(__dirname, 'data', 'access.json')

let supabaseStore = null
/** @type {'supabase' | 'file' | null} */
let activeBackend = null

function isSupabaseNetworkError(err) {
  const message = err instanceof Error ? err.message : String(err)
  const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : ''
  const haystack = `${message} ${cause}`.toLowerCase()
  return (
    haystack.includes('fetch failed') ||
    haystack.includes('econnrefused') ||
    haystack.includes('enotfound') ||
    haystack.includes('etimedout') ||
    haystack.includes('self_signed_cert')
  )
}

async function probeSupabase() {
  const store = await import('./accessStoreSupabase.mjs')
  await store.getUserAccess('__healthcheck__@invalid')
  return store
}

export async function initAccessStore() {
  if (!isSupabaseConfigured()) {
    activeBackend = 'file'
    return
  }
  try {
    supabaseStore = await probeSupabase()
    activeBackend = 'supabase'
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/column .* does not exist|relation .* does not exist/i.test(message)) {
      console.warn(
        '[access] Supabase schema out of date, using access.json until migrations are applied and the API is restarted:',
        message,
      )
    } else {
      console.warn('[access] Supabase unreachable, using access.json:', message)
    }
    activeBackend = 'file'
    supabaseStore = null
  }
}

async function getStore() {
  if (activeBackend == null) {
    await initAccessStore()
  }
  if (activeBackend === 'file' || !isSupabaseConfigured()) {
    return fileStore
  }
  if (!supabaseStore) {
    supabaseStore = await import('./accessStoreSupabase.mjs')
  }
  return supabaseStore
}

async function withSupabaseFallback(operation, fileOperation) {
  const store = await getStore()
  if (store === fileStore) {
    return fileOperation()
  }
  try {
    return await operation(store)
  } catch (err) {
    if (!isSupabaseNetworkError(err)) throw err
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[access] Supabase request failed, using access.json:', message)
    activeBackend = 'file'
    supabaseStore = null
    return fileOperation()
  }
}

const fileStore = {
  async readAccessFile() {
    try {
      const raw = await fs.readFile(ACCESS_FILE, 'utf8')
      const data = JSON.parse(raw)
      if (!data.users || typeof data.users !== 'object') {
        return { users: {} }
      }
      return data
    } catch (err) {
      if (err.code === 'ENOENT') return { users: {} }
      throw err
    }
  },

  async writeAccessFile(data) {
    await fs.mkdir(path.dirname(ACCESS_FILE), { recursive: true })
    const tmp = `${ACCESS_FILE}.${process.pid}.tmp`
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
    await fs.rename(tmp, ACCESS_FILE)
  },
}

export function accessStorageBackend() {
  if (activeBackend) return activeBackend
  return isSupabaseConfigured() ? 'supabase' : 'file'
}

async function listUsersFromFile() {
  const data = await fileStore.readAccessFile()
  return Object.entries(data.users).map(([email, entry]) => ({
    email,
    role: entry.role,
    name: entry.name ?? null,
    employeeId: entry.employeeId ?? null,
    scopedDepartments: normalizeScopedDepartments(entry.scopedDepartments),
    addedAt: entry.addedAt ?? null,
  }))
}

async function getUserAccessFromFile(email) {
  const key = email.toLowerCase()
  const data = await fileStore.readAccessFile()
  return data.users[key] ?? null
}

export async function listUsers() {
  return withSupabaseFallback(
    (store) => store.listUsers(),
    () => listUsersFromFile(),
  )
}

export async function getUserAccess(email) {
  return withSupabaseFallback(
    (store) => store.getUserAccess(email),
    () => getUserAccessFromFile(email),
  )
}

export async function upsertUser(email, { role, name, employeeId, scopedDepartments }, options = {}) {
  const key = email.toLowerCase()
  const enriched = enrichAccessFieldsFromRevolut(
    key,
    { role, name, employeeId },
    options,
  )
  const scoped =
    scopedDepartments !== undefined
      ? normalizeScopedDepartments(scopedDepartments)
      : undefined

  async function upsertToFile() {
    if (!isValidRole(enriched.role)) {
      throw new Error(`Invalid role: ${enriched.role}`)
    }
    const data = await fileStore.readAccessFile()
    const existing = data.users[key]
    data.users[key] = {
      role: enriched.role,
      name: enriched.name ?? existing?.name ?? null,
      employeeId: enriched.employeeId ?? existing?.employeeId ?? null,
      scopedDepartments:
        scoped !== undefined ? scoped : (existing?.scopedDepartments ?? null),
      addedAt: existing?.addedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await fileStore.writeAccessFile(data)
    return data.users[key]
  }

  return withSupabaseFallback(
    (store) =>
      store.upsertUser(email, {
        role: enriched.role,
        name: enriched.name,
        employeeId: enriched.employeeId,
        scopedDepartments: scoped,
      }),
    upsertToFile,
  )
}

export async function removeUser(email) {
  const key = email.toLowerCase()
  return withSupabaseFallback(
    (store) => store.removeUser(email),
    async () => {
      const data = await fileStore.readAccessFile()
      if (!data.users[key]) return false
      delete data.users[key]
      await fileStore.writeAccessFile(data)
      return true
    },
  )
}

export function getBootstrapAdmins() {
  const raw = process.env.AUTH_BOOTSTRAP_ADMINS ?? ''
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export async function bulkUpsertUsers(entries) {
  async function bulkUpsertToFile() {
    const data = await fileStore.readAccessFile()
    let added = 0
    let updated = 0

    for (const entry of entries) {
      const key = entry.email.toLowerCase()
      const enriched = enrichAccessFieldsFromRevolut(key, entry)
      if (!isValidRole(enriched.role)) {
        throw new Error(`Invalid role for ${entry.email}: ${enriched.role}`)
      }
      const existing = data.users[key]
      data.users[key] = {
        role: enriched.role,
        name: enriched.name ?? existing?.name ?? null,
        employeeId: enriched.employeeId ?? existing?.employeeId ?? null,
        addedAt: existing?.addedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      if (existing) updated += 1
      else added += 1
    }

    await fileStore.writeAccessFile(data)
    return { added, updated, total: entries.length }
  }

  return withSupabaseFallback(
    (store) => store.bulkUpsertUsers(entries),
    bulkUpsertToFile,
  )
}

export async function resolveUserRole(email, profileName) {
  const key = email.toLowerCase()
  let entry = await getUserAccess(key)
  if (entry) {
    const enriched = enrichAccessFieldsFromRevolut(key, {
      role: entry.role,
      name: entry.name ?? profileName,
      employeeId: entry.employeeId ?? undefined,
    })
    if (enriched.employeeId && enriched.employeeId !== entry.employeeId) {
      entry = await upsertUser(key, {
        role: entry.role,
        name: enriched.name ?? entry.name ?? profileName,
        employeeId: enriched.employeeId,
      })
    }
    return entry
  }

  const bootstrap = getBootstrapAdmins()
  if (bootstrap.includes(key)) {
    entry = await upsertUser(key, { role: 'admin', name: profileName })
    return entry
  }

  return null
}
