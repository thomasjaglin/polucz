import { describe, it, expect, beforeEach } from 'vitest'
import {
  getCards, saveCard, updateCard, findByLemma, deleteCard, replaceAllCards,
} from './storage'
import type { VocabEntry } from '../data/types'

const card = (id: string, over: Record<string, unknown> = {}) =>
  ({ id, pl: id, en: id, type: 'noun', enriched: false, left: '', right: '', tags: [], ...over }) as unknown as VocabEntry

beforeEach(() => localStorage.clear())

describe('getCards', () => {
  it('returns an empty list on a fresh install rather than throwing', () => {
    expect(getCards()).toEqual([])
  })

  // A corrupt value must not take the app down: the list is the whole product.
  it('returns an empty list when the stored value is not JSON', () => {
    localStorage.setItem('polucz_vocab', '{ broken')
    expect(getCards()).toEqual([])
  })
})

describe('saveCard', () => {
  it('appends a new card', () => {
    saveCard(card('dom'))
    saveCard(card('kot'))
    expect(getCards().map(c => c.id)).toEqual(['dom', 'kot'])
  })

  it('replaces an existing card in place rather than duplicating it', () => {
    saveCard(card('dom', { en: 'house' }))
    saveCard(card('dom', { en: 'home' }))
    const cards = getCards()
    expect(cards).toHaveLength(1)
    expect(cards[0].en).toBe('home')
  })

  it('keeps position when replacing, so the list does not reorder itself', () => {
    saveCard(card('a')); saveCard(card('b')); saveCard(card('c'))
    saveCard(card('b', { en: 'updated' }))
    expect(getCards().map(c => c.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('updateCard', () => {
  it('merges a patch into the stored card', () => {
    saveCard(card('dom', { en: 'house' }))
    updateCard('dom', { enriched: true })
    const stored = findByLemma('dom')!
    expect(stored.enriched).toBe(true)
    expect(stored.en).toBe('house')       // untouched fields survive
  })

  it('is a no-op for an unknown id', () => {
    saveCard(card('dom'))
    updateCard('nieznany', { enriched: true })
    expect(getCards()).toHaveLength(1)
  })
})

describe('deleteCard', () => {
  it('removes only the named card', () => {
    saveCard(card('a')); saveCard(card('b'))
    deleteCard('a')
    expect(getCards().map(c => c.id)).toEqual(['b'])
  })

  it('leaves the collection alone when the id is unknown', () => {
    saveCard(card('a'))
    deleteCard('zzz')
    expect(getCards()).toHaveLength(1)
  })
})

describe('replaceAllCards', () => {
  it('discards what was there — this is what import does', () => {
    saveCard(card('old'))
    replaceAllCards([card('new1'), card('new2')])
    expect(getCards().map(c => c.id)).toEqual(['new1', 'new2'])
  })

  it('survives a round trip of every card shape', () => {
    const all = [card('dom'), card('robić', { type: 'verb' }), card('dobry', { type: 'adjective' })]
    replaceAllCards(all)
    expect(getCards()).toEqual(all)
  })
})
