// Quiz questions, in IndexedDB.
//
// These used to live in localStorage as one JSON blob. That was already 557KB
// for 1,541 sentences, parsed synchronously on the main thread every time the
// quiz mounted, and the tiered plan grows the set toward ~4,477 records. IndexedDB
// is asynchronous, has a far larger quota, and lets later phases query by card
// or type instead of loading everything.
//
// Best-effort throughout: any IndexedDB failure resolves to an empty set rather
// than throwing, so a quiz that cannot load its questions degrades to "no
// questions" instead of a broken screen. Paradigm questions (tier 3) are
// computed from the cards and do not live here at all.

import type { SentenceEntry } from '../data/types'

const DB_NAME = 'polucz-quiz'
const STORE = 'sentences'
const CORPUS_STORE = 'corpusCache'
const VERSION = 2
const LEGACY_KEY = 'polucz_sentences'

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        const store = req.result.createObjectStore(STORE, { keyPath: 'id' })
        // Unused in phase 1, which reads everything, but the tiers that follow
        // select by card and by question type.
        store.createIndex('cardLemma', 'cardLemma', { unique: false })
        store.createIndex('cardType', 'cardType', { unique: false })
      }
      // v2: what the corpus returned for a form, INCLUDING when it returned
      // nothing. Without negative entries the ~third of forms the corpus will
      // never cover get re-queried on every attempt, hammering a volunteer
      // service for a result that cannot change.
      if (!req.result.objectStoreNames.contains(CORPUS_STORE)) {
        req.result.createObjectStore(CORPUS_STORE, { keyPath: 'form' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function readAll(db: IDBDatabase): Promise<SentenceEntry[]> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
    req.onsuccess = () => resolve((req.result as SentenceEntry[]) ?? [])
    req.onerror = () => reject(req.error)
  })
}

function writeAll(db: IDBDatabase, sentences: SentenceEntry[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    // Replace semantics, matching the previous localStorage behaviour and what
    // Import JSON expects: the incoming set becomes the whole set.
    store.clear()
    for (const s of sentences) if (s?.id) store.put(s)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ─── Migration off localStorage ──────────────────────────────────────────────

let migration: Promise<void> | null = null

/**
 * Moves any pre-IndexedDB set across, once. Every read goes through this, so
 * there is no ordering requirement on app start — whoever reads first pays for
 * the move and everyone else waits on the same promise.
 *
 * The legacy key is only removed after the write has committed, so an
 * interruption leaves the old data intact and the next run retries.
 */
function ensureMigrated(): Promise<void> {
  if (migration) return migration
  migration = (async () => {
    let raw: string | null = null
    try {
      raw = localStorage.getItem(LEGACY_KEY)
    } catch { return }
    if (!raw) return

    try {
      const parsed = JSON.parse(raw) as SentenceEntry[]
      if (!Array.isArray(parsed) || parsed.length === 0) {
        localStorage.removeItem(LEGACY_KEY)
        return
      }
      const db = await openDB()
      // Only fill a gap: if IndexedDB already holds questions, they are newer
      // than a leftover blob and must not be clobbered.
      const existing = await readAll(db)
      if (existing.length === 0) await writeAll(db, parsed)
      localStorage.removeItem(LEGACY_KEY)
      console.info(`Migrated ${parsed.length} quiz sentences to IndexedDB`)
    } catch (e) {
      console.warn('Sentence migration failed; leaving localStorage intact', e)
    }
  })()
  return migration
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getSentences(): Promise<SentenceEntry[]> {
  try {
    await ensureMigrated()
    return await readAll(await openDB())
  } catch {
    return []
  }
}

export async function saveSentences(sentences: SentenceEntry[]): Promise<void> {
  try {
    await ensureMigrated()
    await writeAll(await openDB(), sentences)
  } catch (e) {
    console.error('Could not save quiz sentences', e)
  }
}

export async function clearSentences(): Promise<void> {
  try {
    await writeAll(await openDB(), [])
  } catch { /* nothing to clear */ }
}

// ─── Corpus cache (tier 1) ───────────────────────────────────────────────────

export interface CorpusHit { polish: string; english: string; ref?: string }

export interface CorpusCacheEntry {
  /** Exact inflected form searched for — the store's key. */
  form: string
  /** Empty when the corpus had nothing: a negative result worth remembering. */
  hits: CorpusHit[]
  fetchedAt: number
}

export async function getCorpusCache(form: string): Promise<CorpusCacheEntry | null> {
  try {
    const db = await openDB()
    return await new Promise((resolve, reject) => {
      const req = db.transaction(CORPUS_STORE, 'readonly').objectStore(CORPUS_STORE).get(form)
      req.onsuccess = () => resolve((req.result as CorpusCacheEntry) ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

export async function putCorpusCache(entry: CorpusCacheEntry): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CORPUS_STORE, 'readwrite')
      tx.objectStore(CORPUS_STORE).put(entry)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch { /* a cache miss next time is the only cost */ }
}

// ─── Upsert (tiers 1 and 2) ──────────────────────────────────────────────────

/**
 * Adds or replaces individual questions, leaving the rest of the set alone.
 * saveSentences() replaces everything, which is right for Import but wrong for
 * a tier that fills one slot at a time.
 */
export async function putSentences(sentences: SentenceEntry[]): Promise<void> {
  if (sentences.length === 0) return
  try {
    await ensureMigrated()
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      for (const s of sentences) if (s?.id) store.put(s)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (e) {
    console.error('Could not store quiz questions', e)
  }
}
