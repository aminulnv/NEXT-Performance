import 'dotenv/config'
import { buildCacheFromRevolut, saveCacheToDisk } from './buildCache.mjs'

console.log('Warming performance cache from Revolut (several minutes; avoids rate limits)…')
const data = await buildCacheFromRevolut()
await saveCacheToDisk(data)
console.log(`Done: ${data.recordCount} records → server/.cache/performance-records.json`)
