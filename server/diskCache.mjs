import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { isServerless } from './runtime.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const CACHE_FILE = path.join(__dirname, '.cache', 'performance-records.json')

export async function readDiskCache() {
  if (isServerless()) return null
  try {
    const raw = await fs.readFile(CACHE_FILE, 'utf8')
    const data = JSON.parse(raw)
    if (!data?.records || !Array.isArray(data.records)) return null
    return data
  } catch {
    return null
  }
}

export async function writeDiskCache(payload) {
  if (isServerless()) return
  await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true })
  const tmp = `${CACHE_FILE}.${process.pid}.tmp`
  await fs.writeFile(tmp, JSON.stringify(payload), 'utf8')
  await fs.rename(tmp, CACHE_FILE)
}
