// Persistent cache for generated TTS audio, keyed by `${language}:${text}`.
// The vocabulary is stable, so each clip is generated once and reused across
// sessions — this is the main lever against the "lots of audio errors" problem
// (it stops re-hitting the TTS API on every listen). Best-effort: any IndexedDB
// failure (private mode, quota, unsupported) silently falls back to the network.

const DB_NAME = 'polon-audio'
const STORE = 'clips'
const VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

export async function getCachedClip(key: string): Promise<Blob | null> {
  try {
    const db = await openDB()
    return await new Promise<Blob | null>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
      req.onsuccess = () => resolve((req.result as Blob) ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

// True only if BOTH clips for a card are actually present in the cache — the
// source of truth for "this card can play offline without hitting the API",
// independent of the (possibly stale) audioReady flag stored on the card.
export async function hasCachedClips(pl: string, en: string): Promise<boolean> {
  const [p, e] = await Promise.all([getCachedClip(`pl:${pl}`), getCachedClip(`en:${en}`)])
  return !!p && !!e
}

export async function putCachedClip(key: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(blob, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // best-effort persistence; ignore failures
  }
}
