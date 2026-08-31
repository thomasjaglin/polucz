// The backup file format, and the two operations that produce and consume it.
//
// This lives outside the component that draws the menu because import is the
// most destructive operation in the app: it REPLACES the collection rather than
// merging into it, so a file that parses but is not a backup can silently wipe
// a vocabulary built over months. Logic that consequential has to be reachable
// from a test.

import type { VocabEntry, ReviewState, SentenceEntry } from '../data/types'

/** Bumped only when the shape changes in a way an older build cannot read. */
export const BACKUP_VERSION = 1

export interface Backup {
  version: number
  cards: VocabEntry[]
  reviews: Record<string, ReviewState>
  /**
   * Quiz sentences. User-created data since the tiered generator moved onto the
   * device, so a backup that omits them loses work.
   */
  sentences: SentenceEntry[]
}

export function buildBackup(
  cards: VocabEntry[],
  reviews: Record<string, ReviewState>,
  sentences: SentenceEntry[],
): Backup {
  return { version: BACKUP_VERSION, cards, reviews, sentences }
}

/** `polucz-backup-2026-08-31.json` */
export function backupFilename(now: Date = new Date()): string {
  return `polucz-backup-${now.toISOString().slice(0, 10)}.json`
}

export type ParseResult =
  | { ok: true; backup: Backup }
  | { ok: false; reason: string }

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Validates a file before anything is overwritten.
 *
 * Deliberately strict about `cards`: `id` is the lemma and the dedup key, so an
 * entry without one is unusable, and a file containing one is not a backup this
 * app wrote. Rejecting the whole file is the safe failure — the alternative is
 * replacing a real collection with a partially-readable one.
 */
export function parseBackup(text: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'That file is not JSON' }
  }

  if (!isObject(data)) return { ok: false, reason: 'Not a Polucz backup' }
  if (!Array.isArray(data.cards)) return { ok: false, reason: 'Not a Polucz backup — no cards' }
  // typeof null === 'object', so null has to be excluded explicitly or it
  // reaches replaceAllReviews and lands in storage as the string "null".
  if (!isObject(data.reviews)) return { ok: false, reason: 'Not a Polucz backup — no review history' }

  const bad = data.cards.findIndex(c => !isObject(c) || typeof c.id !== 'string' || c.id === '')
  if (bad >= 0) return { ok: false, reason: `Card ${bad + 1} has no lemma — the file looks damaged` }

  // Absent or empty sentences is normal: backups written before the on-device
  // generator, and collections that have never opened the quiz, both lack them.
  const sentences = Array.isArray(data.sentences) ? (data.sentences as SentenceEntry[]) : []

  return {
    ok: true,
    backup: {
      version: typeof data.version === 'number' ? data.version : 0,
      cards: data.cards as VocabEntry[],
      reviews: data.reviews as Record<string, ReviewState>,
      sentences,
    },
  }
}
