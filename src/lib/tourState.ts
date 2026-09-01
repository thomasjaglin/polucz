// Which tours exist, which the user has finished, and where they are in one.
//
// Four tours rather than one long walkthrough (docs: onboarding spec). The
// arrival tour is the guided first run; the other three are offered in place the
// first time their page has something to demonstrate. Each is independent: a
// user can take one, skip another, and replay any of them from Help.
//
// Progress is stored per tour, so backgrounding the app mid-tour resumes where
// it left off instead of starting again or silently giving up.

export type TourId = 'arrival' | 'flashcards' | 'quiz' | 'audio'

export const TOURS: { id: TourId; title: string; blurb: string }[] = [
  { id: 'arrival',    title: 'Getting started',  blurb: 'Translate a phrase, keep the words, look inside a card.' },
  { id: 'flashcards', title: 'Flashcards',       blurb: 'How reviewing works, and what the swipes mean.' },
  { id: 'quiz',       title: 'Quiz',             blurb: 'Where the questions come from, and the two modes.' },
  { id: 'audio',      title: 'Pronunciation',    blurb: 'Hands-free listening, in your phone’s own voice.' },
]

/** 'unseen' → never offered or still pending; the other two are both terminal. */
export type TourStatus = 'unseen' | 'done' | 'skipped'

const KEY = 'polucz_tours'

interface TourRecord {
  status: TourStatus
  /** Index of the step to resume at. Only meaningful while status is 'unseen'. */
  step?: number
}
type Store = Partial<Record<TourId, TourRecord>>

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Store : {}
  } catch {
    return {}
  }
}

function write(store: Store) {
  try { localStorage.setItem(KEY, JSON.stringify(store)) } catch { /* ignore */ }
  listeners.forEach(fn => fn())
}

const listeners = new Set<() => void>()
export function subscribeTours(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function tourStatus(id: TourId): TourStatus {
  return read()[id]?.status ?? 'unseen'
}

/** Where to resume. 0 for a tour that has not been started. */
export function tourStep(id: TourId): number {
  const rec = read()[id]
  return rec?.status === 'unseen' && typeof rec.step === 'number' ? rec.step : 0
}

export function saveTourStep(id: TourId, step: number) {
  const store = read()
  store[id] = { status: 'unseen', step }
  write(store)
}

export function finishTour(id: TourId, how: 'done' | 'skipped') {
  const store = read()
  store[id] = { status: how }
  write(store)
}

/** Puts a tour back to never-seen, so Help can offer it again. */
export function resetTour(id: TourId) {
  const store = read()
  delete store[id]
  write(store)
}

/**
 * Should this page offer its tour right now?
 *
 * Two conditions, and the second is the one that is easy to forget: a tour of an
 * empty page teaches nothing and burns the one moment the user was willing to be
 * taught. Callers pass whether the page actually has something to show.
 */
export function shouldOfferTour(id: TourId, hasSomethingToShow: boolean): boolean {
  return hasSomethingToShow && tourStatus(id) === 'unseen'
}
