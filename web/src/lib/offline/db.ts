// Minimal, dependency-free IndexedDB wrapper for the offline-first layer.
// Backs the durable client-side outbox so a POS terminal never loses a write
// when the edge server or network is unreachable.

const DB_NAME = 'stationsync_offline'
const DB_VERSION = 1
export const OUTBOX_STORE = 'outbox'
export const CACHE_STORE = 'cache'

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const store = db.createObjectStore(OUTBOX_STORE, { keyPath: 'id' })
        store.createIndex('status', 'status', { unique: false })
        store.createIndex('priority', 'priority', { unique: false })
      }
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const req = fn(t.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export async function idbPut<T>(store: string, value: T): Promise<void> {
  await tx(store, 'readwrite', (s) => s.put(value as any))
}

export async function idbGet<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  return tx<T>(store, 'readonly', (s) => s.get(key) as IDBRequest<T>)
}

export async function idbGetAll<T>(store: string): Promise<T[]> {
  return tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>)
}

export async function idbDelete(store: string, key: IDBValidKey): Promise<void> {
  await tx(store, 'readwrite', (s) => s.delete(key))
}

export async function idbCount(store: string): Promise<number> {
  try {
    return await tx<number>(store, 'readonly', (s) => s.count() as IDBRequest<number>)
  } catch {
    return 0
  }
}

export function isOfflineStorageAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}
