import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { parseGoalsCsv } from './parseGoalsCsv.mjs'
import { enrichGoalsWithEmployeeIds } from './enrichGoalsEmployees.mjs'
import { isSupabaseConfigured } from './supabaseAdmin.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const GOALS_CACHE_FILE = path.join(__dirname, '.cache', 'goals.json')

const EMPTY_DATASET = {
  goals: [],
  columns: [],
  columnMap: {},
  importedAt: null,
  source: 'none',
  sourcePath: null,
  hint: 'Export Goals from Revolut People as CSV and upload on Goals or Analytics → Monitoring.',
}

let supabaseGoals = null

async function getSupabaseGoals() {
  if (!isSupabaseConfigured()) return null
  if (!supabaseGoals) {
    supabaseGoals = await import('./goalsStoreSupabase.mjs')
  }
  return supabaseGoals
}

export function goalsStorageBackend() {
  return isSupabaseConfigured() ? 'supabase' : 'file'
}

async function readGoalsCache() {
  try {
    const raw = await fs.readFile(GOALS_CACHE_FILE, 'utf8')
    const data = JSON.parse(raw)
    if (!Array.isArray(data?.goals)) return null
    if (data.source !== 'upload') return null
    return data
  } catch {
    return null
  }
}

async function writeGoalsCache(payload) {
  await fs.mkdir(path.dirname(GOALS_CACHE_FILE), { recursive: true })
  const tmp = `${GOALS_CACHE_FILE}.${process.pid}.tmp`
  await fs.writeFile(tmp, JSON.stringify(payload), 'utf8')
  await fs.rename(tmp, GOALS_CACHE_FILE)
}

export async function importGoalsFromCsv(csvText, { persist = true, importedBy } = {}) {
  const parsed = parseGoalsCsv(csvText)
  if (!parsed.goals.length) {
    throw new Error(
      'CSV parsed to zero goals. Use the Revolut Goals export (Performance → Goals → All Details) and confirm the file has a header row plus goal rows.',
    )
  }
  const enrichedGoals = await enrichGoalsWithEmployeeIds(parsed.goals)
  const payload = {
    goals: enrichedGoals,
    columns: parsed.columns,
    columnMap: parsed.columnMap,
    importedAt: new Date().toISOString(),
    source: 'upload',
    sourcePath: null,
  }
  if (!persist) return payload

  const store = await getSupabaseGoals()
  if (store) {
    return store.saveGoalsToSupabase(payload, { importedBy })
  }
  await writeGoalsCache(payload)
  return payload
}

/** Goals from latest CSV upload (Supabase when configured, else server/.cache/goals.json). */
export async function loadGoalsDataset() {
  const store = await getSupabaseGoals()
  if (store) {
    const fromDb = await store.loadGoalsFromSupabase()
    if (fromDb) {
      const goals = await enrichGoalsWithEmployeeIds(fromDb.goals)
      return { ...fromDb, goals, goalCount: goals.length }
    }
    return { ...EMPTY_DATASET, source: 'none' }
  }
  const cached = await readGoalsCache()
  if (!cached) return EMPTY_DATASET
  const goals = await enrichGoalsWithEmployeeIds(cached.goals)
  return { ...cached, goals, goalCount: goals.length }
}
