import type { SentenceEntry, SentenceNoun, SentenceAdjective, ReviewState, VocabEntry, VocabNoun, NounDeclensions } from '../data/types'

// ─── Display helpers ──────────────────────────────────────────────────────────

export function blankSentence(polish: string, targetForm: string): string {
  const escaped = targetForm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return polish.replace(new RegExp(escaped, 'gi'), '___')
}

export function grammarPrompt(s: SentenceEntry): string {
  const cap = (str: string) => str.charAt(0).toUpperCase() + str.slice(1)
  if (s.cardType === 'noun') return `${cap(s.targetCase)} ${s.targetNumber} of "${s.cardLemma}"`
  if (s.cardType === 'verb') return `${cap(s.targetTense)} tense (${s.targetPronoun}) of "${s.cardLemma}"`
  return `${cap(s.targetCase)} ${s.targetNumber} ${s.targetGender} of "${s.cardLemma}"`
}

// ─── checkAnswer ──────────────────────────────────────────────────────────────

/**
 * Strict exact match: trim whitespace, compare case-insensitively.
 * Polish diacritics are NOT stripped — mowie ≠ mówię.
 */
export function checkAnswer(input: string, targetForm: string): boolean {
  return input.trim().toLowerCase() === targetForm.trim().toLowerCase()
}

// ─── getSessionQuestions ──────────────────────────────────────────────────────

const DEFAULT_EASE = 2.5

/**
 * Returns up to `count` approved sentences of the given quiz type,
 * weighted so cards with a lower SRS easeFactor appear more often.
 *
 * Uses Efraimidis-Spirakis weighted reservoir sampling:
 * assign each item key = random^(1/weight), sort descending, take top N.
 * This gives weighted sampling without replacement in a single pass.
 *
 * Result is shuffled so question order does not reflect weight ranking.
 */
export function getSessionQuestions(
  type: 'declension' | 'conjugation',
  count: number,
  sentences: SentenceEntry[],
  reviews: Record<string, ReviewState>,
): SentenceEntry[] {
  const eligible = sentences.filter(s => {
    if (!s.approved) return false
    if (type === 'declension') return s.cardType === 'noun' || s.cardType === 'adjective'
    return s.cardType === 'verb'
  })

  if (eligible.length === 0) return []
  if (eligible.length <= count) return shuffle(eligible.slice())

  // Weight: 1/easeFactor — harder cards (lower ease) get higher probability
  const keyed = eligible.map(s => {
    const ease = reviews[s.cardLemma]?.easeFactor ?? DEFAULT_EASE
    const weight = 1 / ease
    const key = Math.random() ** (1 / weight)
    return { s, key }
  })

  keyed.sort((a, b) => b.key - a.key)
  return shuffle(keyed.slice(0, count).map(w => w.s))
}

// ─── getDistractors ───────────────────────────────────────────────────────────

// Polish case names as stored in NounDeclensions.cases by enrich-card
// cases array order: [mianownik, dopełniacz, celownik, biernik, narzędnik, miejscownik, wołacz]
//                        nom[0]     gen[1]     dat[2]   acc[3]   inst[4]      loc[5]     voc[6]
const EN_TO_PL_CASE: Record<string, string> = {
  nominative:   'mianownik',
  genitive:     'dopełniacz',
  dative:       'celownik',
  accusative:   'biernik',
  instrumental: 'narzędnik',
  locative:     'miejscownik',
  vocative:     'wołacz',
}

type CaseSlot = { case: string; number: 'singular' | 'plural' }

// Most pedagogically confusable forms per target slot, in priority order
const NOUN_CONFUSION: Record<string, CaseSlot[]> = {
  'nominative singular':   [{ case: 'genitive',     number: 'singular' },
                            { case: 'accusative',   number: 'singular' },
                            { case: 'nominative',   number: 'plural'   }],
  'genitive singular':     [{ case: 'nominative',   number: 'plural'   },
                            { case: 'dative',       number: 'singular' },
                            { case: 'accusative',   number: 'singular' }],
  'dative singular':       [{ case: 'locative',     number: 'singular' },
                            { case: 'genitive',     number: 'singular' },
                            { case: 'instrumental', number: 'singular' }],
  'accusative singular':   [{ case: 'nominative',   number: 'singular' },
                            { case: 'genitive',     number: 'singular' },
                            { case: 'nominative',   number: 'plural'   }],
  'instrumental singular': [{ case: 'locative',     number: 'singular' },
                            { case: 'accusative',   number: 'singular' },
                            { case: 'dative',       number: 'singular' }],
  'locative singular':     [{ case: 'dative',       number: 'singular' },
                            { case: 'instrumental', number: 'singular' },
                            { case: 'genitive',     number: 'singular' }],
  'nominative plural':     [{ case: 'genitive',     number: 'singular' },
                            { case: 'accusative',   number: 'plural'   },
                            { case: 'genitive',     number: 'plural'   }],
  'genitive plural':       [{ case: 'nominative',   number: 'plural'   },
                            { case: 'accusative',   number: 'plural'   },
                            { case: 'dative',       number: 'plural'   }],
}

// Remaining slots used when priority forms are syncretic with the correct answer
const ALL_NOUN_CASES = ['nominative', 'genitive', 'dative', 'accusative', 'instrumental', 'locative']

function getNounForm(d: NounDeclensions, caseName: string, number: 'singular' | 'plural'): string | null {
  const plName = EN_TO_PL_CASE[caseName]
  if (!plName) return null
  const idx = d.cases.indexOf(plName)
  if (idx === -1) return null
  return (number === 'singular' ? d.singular : d.plural)[idx] ?? null
}

/**
 * Returns `count` distractor form strings for a multiple-choice noun question.
 *
 * Strategy: pull other case/number forms of the same word using a pedagogical
 * confusion-priority map, so distractors are plausible inflections rather than
 * forms from unrelated words. Deduplicates via normalised string comparison to
 * handle Polish syncretism (e.g. książki = gen.sg = nom.pl = acc.pl).
 * Falls back to remaining table slots if priorities are all syncretic.
 *
 * Adjective distractors are v2 — returns [] until a confusion map is added.
 */
export function getDistractors(
  correct: SentenceEntry,
  targetCase: string,
  cards: VocabEntry[],
  count: number,
): string[] {
  if (correct.cardType !== 'noun') return []

  const card = cards.find(c => c.id === correct.cardLemma) as VocabNoun | undefined
  const decl = card?.declensions
  if (!decl) return []

  const targetNumber = correct.targetNumber as 'singular' | 'plural'
  const priorities = NOUN_CONFUSION[`${targetCase} ${targetNumber}`] ?? []

  // Remaining slots in the table (for fallback when priorities are all syncretic)
  const priorityKeys = new Set(priorities.map(s => `${s.case} ${s.number}`))
  const fallback: CaseSlot[] = []
  for (const c of ALL_NOUN_CASES) {
    for (const n of ['singular', 'plural'] as const) {
      if (c === targetCase && n === targetNumber) continue
      if (!priorityKeys.has(`${c} ${n}`)) fallback.push({ case: c, number: n })
    }
  }

  const seen = new Set<string>([correct.targetForm.trim().toLowerCase()])
  const result: string[] = []

  for (const slot of [...priorities, ...fallback]) {
    if (result.length >= count) break
    const form = getNounForm(decl, slot.case, slot.number)
    if (!form) continue
    const norm = form.trim().toLowerCase()
    if (seen.has(norm)) continue
    seen.add(norm)
    result.push(form)
  }

  return result
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// Re-export for use in quiz UI
export type { SentenceNoun, SentenceAdjective }
