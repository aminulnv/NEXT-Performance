const DB_NAME = 'next-performance-cache'
const DB_VERSION = 1
const STORE_NAME = 'entries'

export type BrowserCacheStore = 'performance' | 'employees' | 'goals'

type CacheRow<T> = {
  id: string
  data: T
  fetchedAt: string
  savedAt: number
}

function cacheId(userKey: string, store: BrowserCacheStore): string {
  return `${userKey}:${store}`
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error ?? new Error('Failed to open browser cache'))
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

export async function readBrowserCache<T>(
  store: BrowserCacheStore,
  userKey: string,
): Promise<{ data: T; fetchedAt: string; savedAt: number } | null> {
  if (typeof indexedDB === 'undefined') return null
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(cacheId(userKey, store))
      req.onerror = () => reject(req.error ?? new Error('Browser cache read failed'))
      req.onsuccess = () => {
        const row = req.result as CacheRow<T> | undefined
        db.close()
        if (!row) {
          resolve(null)
          return
        }
        resolve({ data: row.data, fetchedAt: row.fetchedAt, savedAt: row.savedAt })
      }
    })
  } catch {
    return null
  }
}

export async function writeBrowserCache<T>(
  store: BrowserCacheStore,
  userKey: string,
  data: T,
  fetchedAt: string,
): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const row: CacheRow<T> = {
        id: cacheId(userKey, store),
        data,
        fetchedAt,
        savedAt: Date.now(),
      }
      const req = tx.objectStore(STORE_NAME).put(row)
      req.onerror = () => reject(req.error ?? new Error('Browser cache write failed'))
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => reject(tx.error ?? new Error('Browser cache transaction failed'))
    })
  } catch {
    // Ignore quota or privacy-mode failures — network data still works.
  }
}

export async function clearBrowserCache(): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).clear()
      req.onerror = () => reject(req.error ?? new Error('Browser cache clear failed'))
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => reject(tx.error ?? new Error('Browser cache clear transaction failed'))
    })
  } catch {
    // Best effort on logout.
  }
}
