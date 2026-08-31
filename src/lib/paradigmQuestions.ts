// Tier 3 of docs/tiered-quiz-generation-plan.md — quiz questions built straight
// from a card's own declension or conjugation table.
//
// No sentence, no network, no API key: the card already holds the answer, so
// every enriched card is quizzable the moment it exists. This is the floor the
// other tiers sit on, and the reason the quiz works on a fresh install.
//
// These are COMPUTED, never stored. Storing them would duplicate the card's own
// table, need invalidating whenever enrichment rewrites it, and add ~670KB for
// data already on the device. A stored sentence for the same slot simply wins
// (see getSessionQuestions).

import type {
  VocabEntry, VocabNoun, VocabVerb, VocabAdjective,
  SentenceEntry, SentenceNoun, SentenceVerb, SentenceAdjective,
} from '../data/types'

// The slots the desktop script enumerates, kept identical so coverage numbers
// and stored sentences line up slot-for-slot.
const NOUN_CASES = [
  { name: 'nominative',   index: 0 },
  { name: 'genitive',     index: 1 },
  { name: 'accusative',   index: 3 },
  { name: 'instrumental', index: 4 },
]
const VERB_PRONOUNS = ['ja', 'ty', 'on/ona', 'my', 'wy', 'oni/one']
const ADJ_GENDERS = ['masculine', 'feminine', 'neuter'] as const

/** An empty table cell. Enrichment writes an em dash where a form doesn't exist. */
function usableForm(raw: string | undefined): string | null {
  const form = raw?.split('/')[0].trim()
  return form && form !== '—' ? form : null
}

/**
 * Stable identity for a grammatical slot, matching the desktop script's
 * makeKey. Used to let a stored sentence take precedence over the computed
 * paradigm question for the same slot.
 */
export function slotKey(s: SentenceEntry): string {
  if (s.cardType === 'noun')      return `${s.cardLemma}::noun::${s.targetCase}::${s.targetNumber}`
  if (s.cardType === 'verb')      return `${s.cardLemma}::verb::${s.targetPronoun}`
  return `${s.cardLemma}::adj::${s.targetGender}`
}

/**
 * Every paradigm question a single card can answer. Empty for unenriched cards
 * and for `unknown`, which have no table to draw on.
 */
export function paradigmQuestionsForCard(card: VocabEntry): SentenceEntry[] {
  if (!card.enriched) return []
  const questions = buildForCard(card)
  return hasSomethingToTest(questions) ? questions : []
}

function buildForCard(card: VocabEntry): SentenceEntry[] {
  const out: SentenceEntry[] = []

  // `approved` is true because there is nothing to approve: the answer comes
  // from the user's own card, not from a model or a corpus.
  const base = { languageToolPassed: false, approved: true, source: 'paradigm' as const }

  if (card.type === 'noun') {
    const decl = (card as VocabNoun).declensions
    if (!decl) return []
    for (const { name, index } of NOUN_CASES) {
      for (const number of ['singular', 'plural'] as const) {
        const form = usableForm(decl[number]?.[index])
        if (!form) continue
        const q: SentenceNoun = {
          ...base,
          id: `${card.id}::noun::${name}::${number}`,
          cardLemma: card.id, cardType: 'noun', targetForm: form,
          targetCase: name, targetNumber: number,
        }
        out.push(q)
      }
    }
    return out
  }

  if (card.type === 'verb') {
    const present = (card as VocabVerb).conjugations?.present
    if (!Array.isArray(present)) return []
    present.slice(0, 6).forEach((raw, i) => {
      const form = usableForm(raw)
      if (!form) return
      const q: SentenceVerb = {
        ...base,
        id: `${card.id}::verb::${VERB_PRONOUNS[i]}`,
        cardLemma: card.id, cardType: 'verb', targetForm: form,
        targetPronoun: VERB_PRONOUNS[i], targetTense: 'present',
      }
      out.push(q)
    })
    return out
  }

  if (card.type === 'adjective') {
    const decl = (card as VocabAdjective).declensions
    if (!decl) return []
    for (const gender of ADJ_GENDERS) {
      // Nominative singular only, matching the script's v1 coverage.
      const form = usableForm(decl[gender]?.[0])
      if (!form) continue
      const q: SentenceAdjective = {
        ...base,
        id: `${card.id}::adj::${gender}`,
        cardLemma: card.id, cardType: 'adjective', targetForm: form,
        targetGender: gender, targetCase: 'nominative', targetNumber: 'singular',
      }
      out.push(q)
    }
    return out
  }

  return []
}

/** Every paradigm question the whole vocabulary can answer. */
export function paradigmQuestions(cards: VocabEntry[]): SentenceEntry[] {
  return cards.flatMap(paradigmQuestionsForCard)
}

/**
 * Drops paradigms with nothing to test. An indeclinable word — Polish `cacy`
 * is one — has the same string in every cell, so "genitive plural of cacy?" has
 * the same answer as every other slot and no wrong answer exists.
 */
function hasSomethingToTest(questions: SentenceEntry[]): boolean {
  return new Set(questions.map(q => q.targetForm.trim().toLowerCase())).size > 1
}
