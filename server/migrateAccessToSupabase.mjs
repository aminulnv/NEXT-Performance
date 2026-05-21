#!/usr/bin/env node
/**
 * Copy users from server/data/access.json → Supabase dashboard_users.
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env
 */
import 'dotenv/config'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { isSupabaseConfigured } from './supabaseAdmin.mjs'
import { bulkUpsertUsers } from './accessStoreSupabase.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ACCESS_FILE = path.join(__dirname, 'data', 'access.json')

async function main() {
  if (!isSupabaseConfigured()) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env')
    process.exit(1)
  }

  const raw = await fs.readFile(ACCESS_FILE, 'utf8')
  const data = JSON.parse(raw)
  const entries = Object.entries(data.users ?? {}).map(([email, u]) => ({
    email,
    role: u.role,
    name: u.name,
    employeeId: u.employeeId,
  }))

  if (!entries.length) {
    console.error('No users in access.json')
    process.exit(1)
  }

  const result = await bulkUpsertUsers(entries)
  console.log(`Migrated ${result.total} users to Supabase (${result.added} new, ${result.updated} updated)`)
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
