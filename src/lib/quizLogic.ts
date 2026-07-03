import type { SentenceEntry, SentenceNoun, SentenceAdjective, ReviewState } from '../data/types'

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

/**
 * Returns `count` distractor form strings for a multiple-choice declension question.
 *
 * Priority 1 (ideal): same cardType + same case + same number/gender slot
 * Priority 2 (fallback): same cardType, any case
 *
 * Guarantees:
 * - Never includes correct.targetForm
 * - Never includes any form from correct.cardLemma
 * - No duplicate form strings in the output
 * - Returns fewer than `count` only if the entire pool is exhausted
 */
export function getDistractors(
  correct: SentenceEntry,
  targetCase: string,
  sentences: SentenceEntry[],
  count: number,
): string[] {
  // Pool: approved, same type, different lemma, different form string
  const seen = new Set<string>([correct.targetForm])
  const pool: SentenceEntry[] = []

  for (const s of sentences) {
    if (!s.approved) continue
    if (s.cardLemma === correct.cardLemma) continue
    if (s.cardType !== correct.cardType) continue
    if (seen.has(s.targetForm)) continue
    seen.add(s.targetForm)
    pool.push(s)
  }

  // Split into priority tiers
  const p1: SentenceEntry[] = []
  const p2: SentenceEntry[] = []

  for (const s of pool) {
    if (sameSlot(correct, s, targetCase)) p1.push(s)
    else p2.push(s)
  }

  // Fill from p1 first, pad with p2 if needed
  const ordered = [...shuffle(p1), ...shuffle(p2)]
  return ordered.slice(0, count).map(s => s.targetForm)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true if `candidate` is in the same grammatical slot as `correct`:
 * same case, and same number (nouns) or same gender (adjectives).
 * TypeScript discriminated-union narrowing handles each branch separately.
 */
function sameSlot(correct: SentenceEntry, candidate: SentenceEntry, targetCase: string): boolean {
  if (correct.cardType === 'noun' && candidate.cardType === 'noun') {
    return candidate.targetCase === targetCase &&
           candidate.targetNumber === correct.targetNumber
  }
  if (correct.cardType === 'adjective' && candidate.cardType === 'adjective') {
    return candidate.targetCase === targetCase &&
           candidate.targetGender === correct.targetGender
  }
  // Verbs: getDistractors is not expected to be called for conjugation
  // (fill-in-the-blank needs no distractors), but handle gracefully
  return false
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
