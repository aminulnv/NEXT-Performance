import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { isValidRole } from './permissions.mjs'
import { enrichAccessFieldsFromRevolut } from './employeeLookup.mjs'
import { isSupabaseConfigured } from './supabaseAdmin.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ACCESS_FILE = path.join(__dirname, 'data', 'access.json')

let supabaseStore = null

async function getStore() {
  if (isSupabaseConfigured()) {
    if (!supabaseStore) {
      supabaseStore = await import('./accessStoreSupabase.mjs')
    }
    return supabaseStore
  }
  return fileStore
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
  return isSupabaseConfigured() ? 'supabase' : 'file'
}

export async function listUsers() {
  const store = await getStore()
  if (store === fileStore) {
    const data = await fileStore.readAccessFile()
    return Object.entries(data.users).map(([email, entry]) => ({
      email,
      role: entry.role,
      name: entry.name ?? null,
      employeeId: entry.employeeId ?? null,
      addedAt: entry.addedAt ?? null,
    }))
  }
  return store.listUsers()
}

export async function getUserAccess(email) {
  const store = await getStore()
  if (store === fileStore) {
    const key = email.toLowerCase()
    const data = await fileStore.readAccessFile()
    return data.users[key] ?? null
  }
  return store.getUserAccess(email)
}

export async function upsertUser(email, { role, name, employeeId }, options = {}) {
  const key = email.toLowerCase()
  const enriched = enrichAccessFieldsFromRevolut(
    key,
    { role, name, employeeId },
    options,
  )

  const store = await getStore()
  if (store === fileStore) {
    if (!isValidRole(enriched.role)) {
      throw new Error(`Invalid role: ${enriched.role}`)
    }
    const data = await fileStore.readAccessFile()
    const existing = data.users[key]
    data.users[key] = {
      role: enriched.role,
      name: enriched.name ?? existing?.name ?? null,
      employeeId: enriched.employeeId ?? existing?.employeeId ?? null,
      addedAt: existing?.addedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await fileStore.writeAccessFile(data)
    return data.users[key]
  }
  return store.upsertUser(email, {
    role: enriched.role,
    name: enriched.name,
    employeeId: enriched.employeeId,
  })
}

export async function removeUser(email) {
  const store = await getStore()
  if (store === fileStore) {
    const key = email.toLowerCase()
    const data = await fileStore.readAccessFile()
    if (!data.users[key]) return false
    delete data.users[key]
    await fileStore.writeAccessFile(data)
    return true
  }
  return store.removeUser(email)
}

export function getBootstrapAdmins() {
  const raw = process.env.AUTH_BOOTSTRAP_ADMINS ?? ''
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export async function bulkUpsertUsers(entries) {
  const store = await getStore()
  if (store === fileStore) {
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
  return store.bulkUpsertUsers(entries)
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
