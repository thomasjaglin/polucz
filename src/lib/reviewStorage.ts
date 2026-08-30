import type { ReviewState } from '../data/types'
import { CONQUERED_INTERVAL } from './scheduler'

const KEY = 'polon_reviews'

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
    conquerProgress: 0,
  }
  saveReview(id, state)
  return state
}

export function replaceAllReviews(reviews: Record<string, ReviewState>): void {
  save(reviews)
}

// Makes non-conquered cards due today so they re-enter the queue.
// Leaves conquered cards (interval >= CONQUERED_INTERVAL) untouched.
export function resetDueReviews(): void {
  const reviews = load()
  const t = today()
  for (const id of Object.keys(reviews)) {
    if (reviews[id].interval < CONQUERED_INTERVAL) {
      reviews[id] = { ...reviews[id], dueDate: t }
    }
  }
  save(reviews)
}

// Hard reset: every card due today including conquered ones.
export function resetAllReviews(): void {
  const reviews = load()
  const t = today()
  for (const id of Object.keys(reviews)) {
    reviews[id] = { ...reviews[id], dueDate: t }
  }
  save(reviews)
}
