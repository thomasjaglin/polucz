// A small bundled vocabulary, so the app does something on a fresh install.
//
// Without this, an unconfigured install is an empty list whose only next step
// is to go and fetch an API key from a provider's website — the flashcards,
// the quiz and pronunciation all work with no key at all, but there is nothing
// for them to work on. The deck turns the keys into an upgrade rather than a
// gate.
//
// Installing is a deliberate action, never automatic. A previous build seeded
// four demo words straight into storage, and the problem was that nobody could
// tell the samples from their own words. Hence `starter: true` on every entry
// and removeStarterDeck() below: what the app added, the app can take back.
//
// The forms are hand-written rather than enriched by an LLM, and every one of
// them was checked against the Hunspell Polish dictionary — see
// scripts/check-starter-deck.mjs. That catches malformed forms of the kind
// enrichment has produced (*dzieckem, *wyść); it cannot catch a real word in
// the wrong grammatical slot.

import type { VocabEntry } from '../data/types'
import { getCards, replaceAllCards } from './storage'
import deck from '../data/starterDeck.json'

export const STARTER_DECK: VocabEntry[] = deck as unknown as VocabEntry[]

export const STARTER_COUNT = STARTER_DECK.length

/** True when at least one starter card is still in the collection. */
export function hasStarterCards(cards: VocabEntry[] = getCards()): boolean {
  return cards.some(c => c.starter)
}

/**
 * Adds the deck, skipping any lemma the user already has.
 *
 * Their card wins on a collision: it may carry review history, audio, or an
 * edited translation, none of which a sample should overwrite.
 *
 * @returns how many cards were actually added.
 */
export function installStarterDeck(): number {
  const existing = getCards()
  const have = new Set(existing.map(c => c.id))
  const fresh = STARTER_DECK.filter(c => !have.has(c.id))
  if (fresh.length > 0) replaceAllCards([...existing, ...fresh])
  return fresh.length
}

/**
 * Removes the cards the starter deck added and nothing else.
 *
 * Review state is left alone: it is keyed by lemma, so it simply stops being
 * referenced, and re-installing the deck would find the old progress intact.
 *
 * @returns how many cards were removed.
 */
export function removeStarterDeck(): number {
  const existing = getCards()
  const kept = existing.filter(c => !c.starter)
  const removed = existing.length - kept.length
  if (removed > 0) replaceAllCards(kept)
  return removed
}
