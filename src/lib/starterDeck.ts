// The two words the arrival tour teaches, and the grammar it reveals for them.
//
// These used to be installed on first launch behind a "Start with dzień dobry"
// button. The tour replaced that: it has the user ADD them from the translate
// page, so the first save is real rather than a reveal of something already
// there, and an empty app stays empty until someone asks for words. Nothing
// installs these cards any more.
//
// The data stays because the tour still needs it. A card added from the
// translate page is genuinely unenriched, so after the simulated wait the modal
// has to be given the paradigm from somewhere — this is that somewhere, and it
// is the same file scripts/check-starter-deck.mjs runs through the Hunspell
// Polish dictionary.
//
// The forms are hand-written rather than enriched by an LLM, and every one of
// them was dictionary-checked. That catches malformed forms of the kind
// enrichment has produced (*dzieckem, *wyść); it cannot catch a real word in
// the wrong grammatical slot.

import type { VocabEntry } from '../data/types'
import deck from '../data/starterDeck.json'

/** The bundled pair, in reading order: dzień, then dobry. */
export const STARTER_DECK: VocabEntry[] = deck as unknown as VocabEntry[]

export const STARTER_COUNT = STARTER_DECK.length
