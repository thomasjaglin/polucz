import { describe, it, expect, beforeEach } from 'vitest'
import {
  STARTER_DECK, STARTER_COUNT, installStarterDeck, removeStarterDeck, hasStarterCards,
} from './starterDeck'
import { getCards, saveCard, replaceAllCards } from './storage'
import { paradigmQuestionsForCard } from './paradigmQuestions'
import type { VocabEntry } from '../data/types'

const mine = (id: string) =>
  ({ id, pl: id, en: 'mine', type: 'noun', enriched: false, left: '', right: '', tags: [] }) as unknown as VocabEntry

beforeEach(() => localStorage.clear())

describe('the deck itself', () => {
  it('is not empty and every card is marked as a starter card', () => {
    expect(STARTER_COUNT).toBeGreaterThan(0)
    expect(STARTER_DECK.every(c => c.starter === true)).toBe(true)
  })

  it('has no duplicate lemmas', () => {
    expect(new Set(STARTER_DECK.map(c => c.id)).size).toBe(STARTER_COUNT)
  })

  // An unenriched card has no forms, so it would give the quiz nothing to ask
  // and the detail view nothing to show — the whole point of shipping a deck.
  it('is fully enriched, with a filled paradigm for every card', () => {
    for (const c of STARTER_DECK) {
      expect(c.enriched, c.id).toBe(true)
      if (c.type === 'noun') {
        expect(c.declensions?.singular, c.id).toHaveLength(7)
        expect(c.declensions?.plural, c.id).toHaveLength(7)
      }
      if (c.type === 'verb') {
        expect(c.conjugations?.present, c.id).toHaveLength(6)
        expect(c.conjugations?.past, c.id).toHaveLength(6)
        expect(c.conjugations?.past2, c.id).toHaveLength(6)
      }
      if (c.type === 'adjective') {
        expect(c.declensions?.masculine, c.id).toHaveLength(7)
        expect(c.declensions?.pluralNonMasc, c.id).toHaveLength(7)
      }
    }
  })

  // The deck is a greeting, not a vocabulary: dzień + dobry = "dzień dobry".
  // If either word or its translation changes, the welcome stops making sense.
  it('is the greeting', () => {
    expect(STARTER_DECK.map(c => c.id)).toEqual(['dzień', 'dobry'])
    expect(STARTER_DECK.map(c => c.en)).toEqual(['day', 'good'])
  })

  it('keeps dzień irregular, which is why it earns a place as a first card', () => {
    const dzien = STARTER_DECK.find(c => c.id === 'dzień')!
    if (dzien.type !== 'noun') throw new Error('dzień should be a noun')
    // The stem drops to dni- everywhere but the nominative and accusative singular.
    expect(dzien.declensions?.singular).toEqual(
      ['dzień', 'dnia', 'dniowi', 'dzień', 'dniem', 'dniu', 'dniu'])
    expect(dzien.declensions?.plural[0]).toBe('dni')
  })

  it('carries a translation and no blank forms', () => {
    for (const c of STARTER_DECK) {
      expect(c.en.trim().length, c.id).toBeGreaterThan(0)
      const strings: string[] = JSON.stringify(c).match(/"[^"]*"/g) ?? []
      expect(strings.includes('""'), c.id).toBe(false)
    }
  })
})

// The point of shipping a deck is that the quiz works before anything is
// configured. Tier 3 builds questions from a card's own table, so this asserts
// the deck actually reaches that floor rather than merely looking populated.
describe('the deck makes the quiz work with no key and no network', () => {
  it('yields paradigm questions for every card', () => {
    for (const c of STARTER_DECK) {
      expect(paradigmQuestionsForCard(c).length, c.id).toBeGreaterThan(0)
    }
  })

  // Two words is a deliberately thin quiz — 11 questions, against 158 from the
  // 26-word deck this replaced. The bar is that a first session is possible at
  // all without a key, not that it is a long one.
  it('yields enough questions for a first session', () => {
    const total = STARTER_DECK.reduce((n, c) => n + paradigmQuestionsForCard(c).length, 0)
    expect(total).toBeGreaterThanOrEqual(10)
  })

  it('asks only for forms the card actually contains', () => {
    for (const c of STARTER_DECK) {
      const text = JSON.stringify(c)
      for (const q of paradigmQuestionsForCard(c)) {
        expect(q.targetForm.trim().length, `${c.id} empty form`).toBeGreaterThan(0)
        expect(text.includes(q.targetForm), `${c.id}: ${q.targetForm}`).toBe(true)
      }
    }
  })
})

describe('installStarterDeck', () => {
  it('writes the whole deck into an empty collection', () => {
    expect(installStarterDeck()).toBe(STARTER_COUNT)
    expect(getCards()).toHaveLength(STARTER_COUNT)
  })

  it('keeps the user’s own cards', () => {
    saveCard(mine('własny'))
    installStarterDeck()
    expect(getCards().find(c => c.id === 'własny')?.en).toBe('mine')
    expect(getCards()).toHaveLength(STARTER_COUNT + 1)
  })

  // Their card may carry review history, cached audio or an edited translation.
  // A sample must never overwrite any of that.
  it('does not overwrite a lemma the user already has', () => {
    const clash = STARTER_DECK[0].id
    saveCard(mine(clash))
    const added = installStarterDeck()
    expect(added).toBe(STARTER_COUNT - 1)
    expect(getCards().find(c => c.id === clash)?.en).toBe('mine')
    expect(getCards().filter(c => c.id === clash)).toHaveLength(1)
  })

  it('is idempotent — installing twice does not duplicate anything', () => {
    installStarterDeck()
    expect(installStarterDeck()).toBe(0)
    expect(getCards()).toHaveLength(STARTER_COUNT)
  })
})

describe('removeStarterDeck', () => {
  it('removes exactly the bundled cards and nothing else', () => {
    saveCard(mine('własny'))
    installStarterDeck()
    expect(removeStarterDeck()).toBe(STARTER_COUNT)
    expect(getCards().map(c => c.id)).toEqual(['własny'])
  })

  it('leaves a user card alone even when it shares a starter lemma', () => {
    const clash = STARTER_DECK[0].id
    saveCard(mine(clash))
    installStarterDeck()
    removeStarterDeck()
    expect(getCards().map(c => c.id)).toEqual([clash])
  })

  it('is a no-op when there is nothing bundled to remove', () => {
    saveCard(mine('własny'))
    expect(removeStarterDeck()).toBe(0)
    expect(getCards()).toHaveLength(1)
  })
})

describe('hasStarterCards', () => {
  it('tracks install and removal', () => {
    expect(hasStarterCards()).toBe(false)
    installStarterDeck()
    expect(hasStarterCards()).toBe(true)
    removeStarterDeck()
    expect(hasStarterCards()).toBe(false)
  })

  it('ignores cards the user wrote', () => {
    replaceAllCards([mine('a'), mine('b')])
    expect(hasStarterCards()).toBe(false)
  })
})
