import type { ReviewState } from '../data/types'

const KEY = 'polucz_reviews'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function load(): Record<string, ReviewState> {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Record<string, ReviewState>) : {}
  } catch {
    return {}
  }
}

function save(reviews: Record<string, ReviewState>): void {
  localStorage.setItem(KEY, JSON.stringify(reviews))
}

export function getReview(id: string): ReviewState | undefined {
  return load()[id]
}

export function getAllReviews(): Record<string, ReviewState> {
  return load()
}

export function saveReview(id: string, state: ReviewState): void {
  const reviews = load()
  reviews[id] = state
  save(reviews)
}

export function initReview(id: string): ReviewState {
  const state: ReviewState = {
    interval: 1,
    easeFactor: 2.5,
    dueDate: today(),
    lastReviewed: null,
    reviewCount: 0,
  }
  saveReview(id, state)
  return state
}

// Sets all existing review dueDates to today so every card becomes due again.
// Preserves SM-2 history (interval, easeFactor).
export function resetAllReviews(): void {
  const reviews = load()
  const t = today()
  for (const id of Object.keys(reviews)) {
    reviews[id] = { ...reviews[id], dueDate: t }
  }
  save(reviews)
}
