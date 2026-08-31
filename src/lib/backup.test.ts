import { describe, it, expect } from 'vitest'
import { buildBackup, backupFilename, parseBackup, BACKUP_VERSION } from './backup'
import type { VocabEntry, ReviewState, SentenceEntry } from '../data/types'

const card = (id: string) => ({ id, pl: id, en: id, type: 'noun' }) as unknown as VocabEntry
const review = (): ReviewState => ({
  interval: 1, easeFactor: 2.5, dueDate: '2026-01-01', lastReviewed: '2025-12-31', reviewCount: 1,
})

describe('buildBackup', () => {
  it('carries cards, reviews and sentences with a version', () => {
    const b = buildBackup([card('dom')], { dom: review() }, [] as SentenceEntry[])
    expect(b.version).toBe(BACKUP_VERSION)
    expect(b.cards).toHaveLength(1)
    expect(b.reviews.dom).toBeDefined()
    expect(b.sentences).toEqual([])
  })

  it('round-trips through JSON unchanged', () => {
    const b = buildBackup([card('dom'), card('kot')], { dom: review() }, [] as SentenceEntry[])
    const back = parseBackup(JSON.stringify(b))
    expect(back.ok).toBe(true)
    if (back.ok) expect(back.backup).toEqual(b)
  })
})

describe('backupFilename', () => {
  it('names the file by date', () => {
    expect(backupFilename(new Date('2026-08-31T22:00:00Z'))).toBe('polucz-backup-2026-08-31.json')
  })
})

describe('parseBackup rejects', () => {
  // Import REPLACES the collection, so each of these is a wipe that must not happen.
  const cases: [string, string][] = [
    ['not JSON at all', 'hello'],
    ['a truncated file', '{"cards": [{"id":"dom"'],
    ['an empty string', ''],
    ['a bare array', '[]'],
    ['null', 'null'],
    ['an object with no cards', '{"reviews":{}}'],
    ['cards that are not an array', '{"cards":"dom","reviews":{}}'],
    ['no review history', '{"cards":[]}'],
    ['a card with no lemma', '{"cards":[{"pl":"dom"}],"reviews":{}}'],
    ['a card that is not an object', '{"cards":["dom"],"reviews":{}}'],
    ['a card with an empty lemma', '{"cards":[{"id":""}],"reviews":{}}'],
  ]
  for (const [label, text] of cases) {
    it(label, () => {
      const r = parseBackup(text)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason.length).toBeGreaterThan(0)
    })
  }

  // typeof null === 'object' in JS, so this one slipped through the original
  // inline check and reached storage as the string "null".
  it('reviews explicitly set to null', () => {
    expect(parseBackup('{"cards":[],"reviews":null}').ok).toBe(false)
  })

  it('names which card is damaged', () => {
    const r = parseBackup('{"cards":[{"id":"dom"},{"pl":"kot"}],"reviews":{}}')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('2')
  })
})

describe('parseBackup accepts', () => {
  it('a backup with no sentences field, as older exports have', () => {
    const r = parseBackup('{"version":1,"cards":[{"id":"dom"}],"reviews":{}}')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.backup.sentences).toEqual([])
  })

  it('a backup with sentences', () => {
    const r = parseBackup('{"cards":[{"id":"dom"}],"reviews":{},"sentences":[{"id":"s1"}]}')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.backup.sentences).toHaveLength(1)
  })

  it('an empty collection — a legitimate state, not a damaged file', () => {
    const r = parseBackup('{"cards":[],"reviews":{}}')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.backup.cards).toEqual([])
  })

  it('a file with no version, treating it as version 0', () => {
    const r = parseBackup('{"cards":[{"id":"dom"}],"reviews":{}}')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.backup.version).toBe(0)
  })
})
