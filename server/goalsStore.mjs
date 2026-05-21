import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { parseGoalsCsv } from './parseGoalsCsv.mjs'

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

export async function importGoalsFromCsv(csvText, { persist = true } = {}) {
  const parsed = parseGoalsCsv(csvText)
  const payload = {
    goals: parsed.goals,
    columns: parsed.columns,
    columnMap: parsed.columnMap,
    importedAt: new Date().toISOString(),
    source: 'upload',
    sourcePath: null,
  }
  if (persist) await writeGoalsCache(payload)
  return payload
}

/** Goals are only loaded from a prior CSV upload (POST /api/goals), not from disk paths. */
export async function loadGoalsDataset() {
  const cached = await readGoalsCache()
  return cached ?? EMPTY_DATASET
}
