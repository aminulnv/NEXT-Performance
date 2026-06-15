#!/usr/bin/env node
/**
 * Import users from CSV into server/data/access.json (no login required).
 *
 * Usage:
 *   node server/importAccessCsv.mjs path/to/users.csv
 *   npm run access:import -- path/to/users.csv
 */
import 'dotenv/config'
import fs from 'fs/promises'
import path from 'path'
import { parseAccessCsv } from './parseAccessCsv.mjs'
import { bulkUpsertUsers } from './accessStore.mjs'

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Usage: node server/importAccessCsv.mjs <users.csv>')
    process.exit(1)
  }

  const resolved = path.resolve(process.cwd(), filePath)
  const csvText = await fs.readFile(resolved, 'utf8')
  const { users, errors } = parseAccessCsv(csvText)

  if (errors.length) {
    console.error('CSV errors:')
    errors.forEach((e) => console.error(`  - ${e}`))
    process.exit(1)
  }

  if (!users.length) {
    console.error('No users to import.')
    process.exit(1)
  }

  const result = await bulkUpsertUsers(users)
  console.log(
    `Imported ${result.total} users (${result.added} new, ${result.updated} updated) → server/data/access.json`,
  )
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
