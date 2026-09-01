import { describe, it, expect } from 'vitest'
import { STARTER_DECK, STARTER_COUNT } from './starterDeck'
import { paradigmQuestionsForCard } from './paradigmQuestions'
import { tourEnrichment } from '../data/tourFixture'
import type { VocabEntry } from '../data/types'

// These two cards are no longer installed — the arrival tour has the user add
// them, and then borrows their grammar to fill the card in. So what matters now
// is that the data is correct and complete, not that it can be installed.

describe('the pair', () => {
  it('is the greeting, in reading order', () => {
    expect(STARTER_DECK.map(c => c.id)).toEqual(['dzień', 'dobry'])
    expect(STARTER_DECK.map(c => c.en)).toEqual(['day', 'good'])
    expect(STARTER_COUNT).toBe(2)
  })

  it('keeps dzień irregular, which is why it earns a place as a first card', () => {
    const dzien = STARTER_DECK.find(c => c.id === 'dzień')!
    if (dzien.type !== 'noun') throw new Error('dzień should be a noun')
    // The stem drops to dni- everywhere but the nominative and accusative singular.
    expect(dzien.declensions?.singular).toEqual(
      ['dzień', 'dnia', 'dniowi', 'dzień', 'dniem', 'dniu', 'dniu'])
    expect(dzien.declensions?.plural[0]).toBe('dni')
  })

  it('is fully enriched, with a filled paradigm for each card', () => {
    for (const c of STARTER_DECK) {
      expect(c.enriched, c.id).toBe(true)
      if (c.type === 'noun') {
        expect(c.declensions?.singular, c.id).toHaveLength(7)
        expect(c.declensions?.plural, c.id).toHaveLength(7)
      }
      if (c.type === 'adjective') {
        expect(c.declensions?.masculine, c.id).toHaveLength(7)
        expect(c.declensions?.pluralNonMasc, c.id).toHaveLength(7)
        expect(c.comparative, c.id).toBeTruthy()
        expect(c.superlative, c.id).toBeTruthy()
      }
    }
  })

  it('carries a translation and no blank forms', () => {
    for (const c of STARTER_DECK) {
      expect(c.en.trim().length, c.id).toBeGreaterThan(0)
      const strings: string[] = JSON.stringify(c).match(/"[^"]*"/g) ?? []
      expect(strings.includes('""'), c.id).toBe(false)
    }
  })
})

describe('what the tour borrows from it', () => {
  // A card added from the translate page is unenriched, so the modal is handed
  // the paradigm from here after its simulated wait.
  const added = (id: string, type: string) =>
    ({ id, pl: id, en: 'x', type, enriched: false, left: '', right: '', tags: [] }) as unknown as VocabEntry

  it('fills a freshly added card with the bundled grammar', () => {
    const filled = tourEnrichment(added('dzień', 'noun'))
    expect(filled).not.toBeNull()
    expect(filled!.enriched).toBe(true)
    if (filled!.type !== 'noun') throw new Error('type should survive')
    expect(filled!.declensions?.singular[1]).toBe('dnia')
  })

  it('keeps the user’s own translation rather than overwriting it', () => {
    const mine = { ...added('dobry', 'adjective'), en: 'my own note' } as VocabEntry
    expect(tourEnrichment(mine)!.en).toBe('my own note')
  })

  // They added the word; it is theirs, not a sample the app planted.
  it('does not mark the card as a starter card', () => {
    expect(tourEnrichment(added('dobry', 'adjective'))!.starter).toBeUndefined()
  })

  it('declines a word it has no data for, and a type mismatch', () => {
    expect(tourEnrichment(added('kot', 'noun'))).toBeNull()
    expect(tourEnrichment(added('dzień', 'verb'))).toBeNull()
  })
})

describe('the tour has something to quiz on afterwards', () => {
  it('yields paradigm questions for both words', () => {
    for (const c of STARTER_DECK) {
      expect(paradigmQuestionsForCard(c).length, c.id).toBeGreaterThan(0)
    }
  })

  it('asks only for forms the card actually contains', () => {
    for (const c of STARTER_DECK) {
      const text = JSON.stringify(c)
      for (const q of paradigmQuestionsForCard(c)) {
        expect(text.includes(q.targetForm), `${c.id}: ${q.targetForm}`).toBe(true)
      }
    }
  })
})
