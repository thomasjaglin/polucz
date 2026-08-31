import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  applyEasy, applyHard, applyConquered, applyLapse,
  isConquered, getDueCards, CONQUERED_INTERVAL,
} from './scheduler'
import type { ReviewState, VocabEntry } from '../data/types'

const state = (over: Partial<ReviewState> = {}): ReviewState => ({
  interval: 10,
  easeFactor: 2.5,
  dueDate: '2026-01-01',
  lastReviewed: '2025-12-22',
  reviewCount: 3,
  ...over,
})

// Every scheduler result is relative to "now", so the clock is pinned. Without
// this the due-date assertions pass or fail depending on the day they run.
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-03-01T12:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('applyEasy', () => {
  it('multiplies the interval by the ease factor and nudges ease up', () => {
    const r = applyEasy(state({ interval: 10, easeFactor: 2.5 }))
    expect(r.interval).toBe(25)
    expect(r.easeFactor).toBeCloseTo(2.55)
  })

  it('advances the due date by the new interval', () => {
    const r = applyEasy(state({ interval: 10, easeFactor: 2.5 }))
    expect(r.dueDate).toBe('2026-03-26')       // 1 March + 25 days
    expect(r.lastReviewed).toBe('2026-03-01')
    expect(r.reviewCount).toBe(4)
  })
})

describe('applyHard', () => {
  it('grows the interval slowly and penalises ease', () => {
    const r = applyHard(state({ interval: 10, easeFactor: 2.5 }))
    expect(r.interval).toBeCloseTo(12)
    expect(r.easeFactor).toBeCloseTo(2.42)
  })

  it('never returns an interval below one day', () => {
    const r = applyHard(state({ interval: 0 }))
    expect(r.interval).toBeGreaterThanOrEqual(1)
    expect(r.dueDate).toBe('2026-03-02')
  })
})

describe('applyLapse', () => {
  it('resets the interval to a day and drops ease by 0.2', () => {
    const r = applyLapse(state({ interval: 90, easeFactor: 2.5 }))
    expect(r.interval).toBe(1)
    expect(r.easeFactor).toBeCloseTo(2.3)
    expect(r.dueDate).toBe('2026-03-02')
  })

  it('clamps ease at the 1.3 floor rather than spiralling down', () => {
    let s = state({ easeFactor: 1.4 })
    for (let i = 0; i < 5; i++) s = applyLapse(s)
    expect(s.easeFactor).toBe(1.3)
  })
})

describe('conquering', () => {
  it('sets the long interval and the explicit flag', () => {
    const r = applyConquered(state())
    expect(r.interval).toBe(CONQUERED_INTERVAL)
    expect(r.conquered).toBe(true)
    expect(isConquered(r)).toBe(true)
  })

  // The regression this guards: an interval reaching 180 through ordinary good
  // reviews must NOT count as conquered, or well-reviewed cards silently leave
  // the game without the user ever saying so.
  it('does not treat a naturally long interval as conquered', () => {
    const grown = state({ interval: CONQUERED_INTERVAL, conquered: undefined })
    expect(isConquered(grown)).toBe(false)
  })

  it('stays conquered after a later review', () => {
    expect(isConquered(applyEasy(applyConquered(state())))).toBe(true)
  })
})

describe('getDueCards', () => {
  const card = (id: string) => ({ id, pl: id, en: id }) as VocabEntry

  it('includes cards due today, overdue cards, and cards never reviewed', () => {
    const cards = [card('a'), card('b'), card('c'), card('d')]
    const reviews = {
      a: state({ dueDate: '2026-03-01' }),   // today
      b: state({ dueDate: '2026-02-01' }),   // overdue
      c: state({ dueDate: '2026-04-01' }),   // not yet
      // d has never been reviewed
    }
    expect(getDueCards(cards, reviews).map(c => c.id).sort()).toEqual(['a', 'b', 'd'])
  })

  it('does not mutate or drop the caller’s array', () => {
    const cards = [card('a'), card('b'), card('c')]
    const snapshot = [...cards]
    getDueCards(cards, {})
    expect(cards).toEqual(snapshot)
  })

  it('returns every due card despite shuffling', () => {
    const cards = Array.from({ length: 20 }, (_, i) => card(String(i)))
    const out = getDueCards(cards, {})
    expect(out).toHaveLength(20)
    expect(new Set(out.map(c => c.id)).size).toBe(20)
  })
})
