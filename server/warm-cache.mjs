import 'dotenv/config'
import { buildCacheFromRevolut, saveCache } from './buildCache.mjs'
import { isPerformanceSupabaseCacheEnabled } from './performanceStoreSupabase.mjs'

console.log('Warming performance cache from Revolut (several minutes; avoids rate limits)…')
const data = await buildCacheFromRevolut()
await saveCache(data)
const targets = ['server/.cache/performance-records.json']
if (isPerformanceSupabaseCacheEnabled()) targets.push('Supabase (encrypted)')
console.log(`Done: ${data.recordCount} records → ${targets.join(' + ')}`)
