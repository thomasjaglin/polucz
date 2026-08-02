import type { ReviewState } from '../data/types'
import type { VocabEntry } from '../data/types'

const EASE_MIN = 1.3
export const CONQUERED_INTERVAL = 180

export function isConquered(state: ReviewState): boolean {
  // Explicit conquer only — the SRS interval reaching 180 on its own must NOT
  // count, or well-reviewed cards would silently "master" and leave the game.
  return state.conquered === true
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + Math.max(1, Math.round(days)))
  return d.toISOString().slice(0, 10)
}

function bump(state: ReviewState, interval: number, easeFactor: number): ReviewState {
  return {
    ...state,
    interval,
    easeFactor: Math.max(EASE_MIN, easeFactor),
    dueDate: addDays(interval),
    lastReviewed: today(),
    reviewCount: state.reviewCount + 1,
  }
}

// Swipe right — "Somewhat easy" (SM-2 Good)
export function applyEasy(state: ReviewState): ReviewState {
  const interval = state.interval * state.easeFactor
  return bump(state, interval, state.easeFactor + 0.05)
}

// Swipe left — "Somewhat hard" (SM-2 Hard)
export function applyHard(state: ReviewState): ReviewState {
  const interval = Math.max(1, state.interval * 1.2)
  return bump(state, interval, state.easeFactor - 0.08)
}

// Button — "Conquered": override to very long interval, not a normal SM-2 step
export function applyConquered(state: ReviewState): ReviewState {
  return { ...bump(state, CONQUERED_INTERVAL, state.easeFactor + 0.1), conquered: true }
}

// Button — "Again" (lapse): reset interval, penalise ease factor
export function applyLapse(state: ReviewState): ReviewState {
  return bump(state, 1, state.easeFactor - 0.2)
}

// Returns cards that are due today or earlier, plus any with no review state yet.
// Shuffled so the order is random each session.
export function getDueCards(
  cards: VocabEntry[],
  reviews: Record<string, ReviewState>,
): VocabEntry[] {
  const t = today()
  const due = cards.filter(c => {
    const r = reviews[c.id]
    return !r || r.dueDate <= t
  })
  // Fisher-Yates shuffle
  for (let i = due.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[due[i], due[j]] = [due[j], due[i]]
  }
  return due
}
