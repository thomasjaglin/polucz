// The app's first two words: dzień and dobry — "dzień dobry", good day.
//
// Without them an unconfigured install is an empty list whose only next step is
// to go and fetch an API key from a provider's website. Flashcards, the quiz and
// pronunciation all work with no key at all; they just had nothing to work on.
// This turns the key into an upgrade rather than a gate.
//
// Two words rather than a vocabulary, because the point is the greeting: the app
// says hello in the language it is about to teach, and the pair is genuinely
// worth knowing. `dzień` also earns its place as a first card — its stem drops
// to dni- in every form but the nominative and accusative singular, so the card
// shows immediately what the app is for. The cost is a thin first quiz: 11
// questions, against 158 from the 26-word deck this replaced.
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
  // Written back to front. The list renders newest-first, so appending in
  // reading order would put "dobry" above "dzień" and show the greeting
  // backwards — the one thing this deck exists to get right.
  if (fresh.length > 0) replaceAllCards([...existing, ...[...fresh].reverse()])
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
