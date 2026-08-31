import { paradigmQuestions, slotKey } from './paradigmQuestions'
import type { SentenceEntry, SentenceNoun, SentenceAdjective, ReviewState, VocabEntry, VocabNoun, VocabAdjective, NounDeclensions } from '../data/types'

// ─── Display helpers ──────────────────────────────────────────────────────────

export function blankSentence(polish: string, targetForm: string): string {
  const escaped = targetForm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Letter boundaries, not \b: \b is ASCII-only, so it mis-handles ł, ó and ż.
  // Without them the target matches inside longer words — "dom" in "W domu"
  // blanked as "W ___u", leaking the stem and mangling the sentence. Generated
  // sentences mostly hid this by using the form standalone; corpus text will not.
  const bounded = new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'giu')
  return polish.replace(bounded, '___')
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
 * Up to `count` questions of the given quiz type, drawn from stored sentences
 * first and topped up from computed paradigm questions (tier 3).
 *
 * Result is shuffled so question order does not reflect weight ranking.
 */
export function getSessionQuestions(
  type: 'declension' | 'conjugation',
  count: number,
  sentences: SentenceEntry[],
  reviews: Record<string, ReviewState>,
  cards: VocabEntry[] = [],
): SentenceEntry[] {
  const ofType = (s: SentenceEntry) =>
    type === 'declension'
      ? s.cardType === 'noun' || s.cardType === 'adjective'
      : s.cardType === 'verb'

  // One question per slot. Legacy script records key on a UUID while corpus and
  // generated ones key on the slot, so the same form can be present twice; and a
  // corpus sentence is preferred over a generated one because a human wrote it.
  const bySlot = new Map<string, SentenceEntry>()
  for (const s of sentences) {
    if (!s.approved || !ofType(s)) continue
    const key = slotKey(s)
    const held = bySlot.get(key)
    if (!held || rank(s) > rank(held)) bySlot.set(key, s)
  }
  const stored = [...bySlot.values()]

  // Paradigm questions fill slots no stored sentence covers. A sentence is the
  // better question — it has context — so it always wins its slot, and the
  // paradigm pool only tops the session up when there are not enough.
  const covered = new Set(stored.map(slotKey))
  const paradigm = paradigmQuestions(cards).filter(q => ofType(q) && !covered.has(slotKey(q)))

  const chosen = sample(stored, count, reviews)
  if (chosen.length < count) {
    chosen.push(...sample(paradigm, count - chosen.length, reviews))
  }
  return shuffle(chosen)
}

/** Corpus beats generated beats a record with no source (the desktop script). */
function rank(s: SentenceEntry): number {
  if (s.source === 'corpus') return 3
  if (s.source === 'paradigm') return 1
  return 2
}

/**
 * Efraimidis-Spirakis weighted reservoir sampling: assign each item
 * key = random^(1/weight), sort descending, take top N. Weighted sampling
 * without replacement in a single pass.
 *
 * Weight is 1/easeFactor, so cards the user finds harder come up more often.
 */
function sample(
  pool: SentenceEntry[],
  count: number,
  reviews: Record<string, ReviewState>,
): SentenceEntry[] {
  if (count <= 0 || pool.length === 0) return []
  if (pool.length <= count) return pool.slice()

  const keyed = pool.map(s => {
    const ease = reviews[s.cardLemma]?.easeFactor ?? DEFAULT_EASE
    const weight = 1 / ease
    return { s, key: Math.random() ** (1 / weight) }
  })
  keyed.sort((a, b) => b.key - a.key)
  return keyed.slice(0, count).map(w => w.s)
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

function getNounForm(d: NounDeclensions, caseName: string, number: 'singular' | 'plural'): string | null {
  const plName = EN_TO_PL_CASE[caseName]
  if (!plName) return null
  const idx = d.cases.indexOf(plName)
  if (idx === -1) return null
  return (number === 'singular' ? d.singular : d.plural)[idx] ?? null
}

/**
 * Returns exactly `count` distractor form strings for a multiple-choice noun question.
 *
 * Four-tier fallback chain:
 *   1. Priority confusion-map slots (most pedagogically confusable for this case/number)
 *   2. All remaining slots in the word's declension table (7 cases × 2 numbers)
 *   3. Cross-word forms from the sentences dataset (same-case preferred)
 *   4. Duplicate a distractor rather than return fewer than count
 *
 * Deduplicates via normalised string comparison throughout (Polish syncretism means
 * the same surface form can appear in many slots — e.g. książki = gen.sg = nom.pl).
 * Logs a console.error if the invariant (result.length === count) is violated.
 *
 * Adjective distractors are v2 — returns [] until a confusion map is added.
 */
/**
 * Distractors for an adjective, drawn from the card's own table.
 *
 * Closest-first, because a distractor is only useful if it is plausible:
 * the same case in the other genders (the confusion the question is actually
 * testing), then other cases within the asked gender, then the plural columns.
 */
function adjectiveDistractors(
  correct: SentenceAdjective,
  cards: VocabEntry[],
  count: number,
  sentences: SentenceEntry[] = [],
): string[] {
  const card = cards.find(c => c.id === correct.cardLemma) as VocabAdjective | undefined
  const decl = card?.declensions
  if (!decl) return []

  const caseIndex = decl.cases.findIndex(
    c => c.trim().toLowerCase() === correct.targetCase.trim().toLowerCase(),
  )
  // Enrichment writes Polish case names; the question carries English ones, so a
  // lookup miss is expected. Nominative is row 0 in every column.
  const row = caseIndex >= 0 ? caseIndex : 0

  const GENDERS = ['masculine', 'feminine', 'neuter'] as const
  const columns: (keyof typeof decl)[] = [...GENDERS, 'pluralMasc', 'pluralNonMasc']
  const otherGenders = GENDERS.filter(g => g !== correct.targetGender)

  const candidates: string[] = []
  // 1. same case, other genders
  for (const g of otherGenders) candidates.push(decl[g]?.[row])
  // 2. other cases, asked gender
  const askedColumn = (GENDERS as readonly string[]).includes(correct.targetGender)
    ? (correct.targetGender as 'masculine' | 'feminine' | 'neuter')
    : 'masculine'
  decl[askedColumn]?.forEach((f, i) => { if (i !== row) candidates.push(f) })
  // 3. anything else in the table
  for (const col of columns) decl[col]?.forEach(f => candidates.push(f))

  // Cross-word fallback, as nouns already have: an indeclinable adjective has
  // one form in every cell, so its own table yields nothing. Other adjectives
  // in the vocabulary are still plausible wrong answers.
  if (candidates.filter(Boolean).length) {
    for (const c of cards) {
      if (c.id === correct.cardLemma || c.type !== 'adjective') continue
      const d = (c as VocabAdjective).declensions
      if (d) for (const g of GENDERS) candidates.push(d[g]?.[row] ?? d[g]?.[0])
    }
    for (const s of sentences) {
      if (s.cardType === 'adjective' && s.cardLemma !== correct.cardLemma) candidates.push(s.targetForm)
    }
  }

  const seen = new Set<string>([correct.targetForm.trim().toLowerCase()])
  const result: string[] = []
  for (const raw of candidates) {
    if (result.length >= count) break
    // Slash alternates ("pięknego/piękny") would show two answers in one button.
    const form = raw?.split('/')[0].trim()
    if (!form || form === '—') continue
    const norm = form.toLowerCase()
    if (seen.has(norm)) continue   // never offer a second correct answer (§2.3)
    seen.add(norm)
    result.push(form)
  }
  return result
}

export function getDistractors(
  correct: SentenceEntry,
  targetCase: string,
  cards: VocabEntry[],
  count: number,
  sentences: SentenceEntry[] = [],
): string[] {
  // Adjectives have their own table shape (columns by gender, rows by case), so
  // they get their own builder. Before this they fell through the `return []`
  // below and every adjective question rendered a single option — the correct
  // answer — which is a freebie, not a question.
  if (correct.cardType === 'adjective') {
    return adjectiveDistractors(correct, cards, count, sentences)
  }
  if (correct.cardType !== 'noun') return []
  // correct is SentenceNoun from here (control-flow narrowing)

  const seen = new Set<string>([correct.targetForm.trim().toLowerCase()])
  const result: string[] = []

  // ── Tier 1 + 2: same word's declension table ──────────────────────────────
  const card = cards.find(c => c.id === correct.cardLemma) as VocabNoun | undefined
  const decl = card?.declensions

  if (decl) {
    const targetNumber = correct.targetNumber as 'singular' | 'plural'
    const priorities = NOUN_CONFUSION[`${targetCase} ${targetNumber}`] ?? []
    const priorityKeys = new Set(priorities.map(s => `${s.case} ${s.number}`))

    // All 7 cases × 2 numbers, minus the correct slot, priorities handled separately
    // cases: nominative[0] genitive[1] dative[2] accusative[3] instrumental[4] locative[5] vocative[6]
    const ALL_CASES_7 = ['nominative','genitive','dative','accusative',
                         'instrumental','locative','vocative']
    const fallback: CaseSlot[] = []
    for (const c of ALL_CASES_7) {
      for (const n of ['singular', 'plural'] as const) {
        if (c === targetCase && n === targetNumber) continue
        if (!priorityKeys.has(`${c} ${n}`)) fallback.push({ case: c, number: n })
      }
    }

    for (const slot of [...priorities, ...fallback]) {
      if (result.length >= count) break
      const form = getNounForm(decl, slot.case, slot.number)
      if (!form) continue
      const norm = form.trim().toLowerCase()
      if (seen.has(norm)) continue
      seen.add(norm)
      result.push(form)
    }
  }

  // ── Tier 3: cross-word forms from the sentences dataset ───────────────────
  if (result.length < count && sentences.length > 0) {
    const sameCaseForms: string[] = []
    const anyForms: string[] = []
    const t3Seen = new Set<string>(seen) // local copy — only pollute `seen` for forms we use

    for (const s of sentences) {
      if (!s.approved) continue
      if (s.cardLemma === correct.cardLemma) continue
      if (s.cardType !== 'noun') continue
      // s is SentenceNoun here
      const norm = s.targetForm.trim().toLowerCase()
      if (t3Seen.has(norm)) continue
      t3Seen.add(norm)
      if (s.targetCase === targetCase && s.targetNumber === correct.targetNumber) {
        sameCaseForms.push(s.targetForm)
      } else {
        anyForms.push(s.targetForm)
      }
    }

    for (const form of [...shuffle(sameCaseForms), ...shuffle(anyForms)]) {
      if (result.length >= count) break
      seen.add(form.trim().toLowerCase())
      result.push(form)
    }
  }

  // ── Tier 4: duplicate rather than show fewer than count ───────────────────
  if (result.length > 0 && result.length < count) {
    console.error(
      `[getDistractors] only ${result.length} unique forms for` +
      ` "${correct.cardLemma}" ${targetCase} ${correct.targetNumber}` +
      ` — duplicating to reach ${count}`
    )
    const snapshot = [...result]
    let i = 0
    while (result.length < count) result.push(snapshot[i++ % snapshot.length])
  }

  if (result.length < count) {
    console.error(
      `[getDistractors] invariant violated: no forms at all for` +
      ` "${correct.cardLemma}" — no declension table and sentences dataset empty`
    )
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
