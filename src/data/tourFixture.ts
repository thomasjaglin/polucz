// Everything the arrival tour shows, shipped in the app.
//
// The tour never touches the network — not for anyone, keys or no keys. So the
// translation, the lemma split and the example sentences all come from here,
// and the waiting is simulated. What is NOT here: the declension tables, which
// come from the real bundled starter cards, and the save itself, which really
// writes to storage.
//
// The example sentences are real Tatoeba lines lifted from the bundled corpus
// (public/pol-corpus.txt) rather than written for the demo. Fixing the pick
// keeps the tour identical on every run, which is what lets a spotlight know
// what is on screen.

import type { VocabEntry } from './types'
import deck from './starterDeck.json'

export const TOUR_SENTENCE = 'Dzień dobry!'
export const TOUR_TRANSLATION = 'Good day!'

export interface TourLemma {
  lemma: string
  type: 'noun' | 'adjective'
  en: string
  /** Shown on the word row, as the real analyser would. */
  note: string
}

export const TOUR_LEMMAS: TourLemma[] = [
  { lemma: 'dzień', type: 'noun',      en: 'day',  note: 'm.' },
  { lemma: 'dobry', type: 'adjective', en: 'good', note: 'nom. m.' },
]

/** Attributed to Tatoeba wherever they are shown, same as any corpus sentence. */
export const TOUR_EXAMPLES: Record<string, { pl: string; en: string }[]> = {
  'dzień': [
    { pl: 'Cały dzień grałem w tenisa.', en: 'I played tennis all day.' },
    { pl: 'Przeszła 20 mil w jeden dzień.', en: 'She walked 20 miles in one day.' },
    { pl: 'Połowa biura wzięła dzień wolnego.', en: 'Half the office took the day off.' },
  ],
  'dobry': [
    { pl: 'To dobry pomysł, żeby pograć w shogi po obiedzie.', en: 'It is a good idea to play shogi after dinner.' },
    { pl: 'Powiedziałem sobie: to dobry pomysł.', en: 'I said to myself: that is a good idea.' },
    { pl: 'Dobry wieczór, jak leci?', en: 'Good evening, how is it going?' },
  ],
}

// Calibrated against the real calls rather than guessed, so the tour teaches the
// right expectation. Lemmatisation and enrichment are LLM calls and are slow;
// DeepL is quick; the corpus is nearly instant but not free.
export const FAKE_LATENCY = {
  translate: 700,
  lemmatise: 1600,
  enrich: 2200,
  examples: 600,
} as const

/** Resolves after a scripted wait, so callers read like the real async ones. */
export function fakeWait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * The filled-in grammar for a word the tour added.
 *
 * A card added from the translate page is genuinely unenriched — that is what
 * the real flow produces — so after the simulated wait there would be nothing to
 * reveal. This supplies what enrichment would have returned, from the same
 * bundled cards the app already ships and already dictionary-checks.
 *
 * The user's own fields win: they added this word, so it keeps their
 * translation and its provenance, and it is NOT marked as a starter card.
 */
export function tourEnrichment(entry: VocabEntry): VocabEntry | null {
  const source = (deck as unknown as VocabEntry[]).find(c => c.id === entry.id)
  if (!source || source.type !== entry.type) return null
  const { id: _id, pl: _pl, en: _en, tags: _tags, starter: _starter, sourceContext: _sc, ...grammar } = source
  return { ...entry, ...grammar, enriched: true } as VocabEntry
}
