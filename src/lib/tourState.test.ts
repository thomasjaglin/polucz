import { describe, it, expect, beforeEach } from 'vitest'
import {
  TOURS, tourStatus, tourStep, saveTourStep, finishTour, resetTour,
  shouldOfferTour, subscribeTours,
} from './tourState'

beforeEach(() => localStorage.clear())

describe('the registry', () => {
  it('lists every tour with something to show in Help', () => {
    expect(TOURS.map(t => t.id)).toEqual(['arrival', 'flashcards', 'quiz', 'audio'])
    for (const t of TOURS) {
      expect(t.title.length).toBeGreaterThan(0)
      expect(t.blurb.length).toBeGreaterThan(0)
    }
  })
})

describe('status', () => {
  it('starts unseen', () => {
    expect(tourStatus('arrival')).toBe('unseen')
    expect(tourStep('arrival')).toBe(0)
  })

  it('remembers finishing and skipping separately', () => {
    finishTour('arrival', 'done')
    finishTour('quiz', 'skipped')
    expect(tourStatus('arrival')).toBe('done')
    expect(tourStatus('quiz')).toBe('skipped')
    expect(tourStatus('flashcards')).toBe('unseen')
  })

  it('survives a corrupt store rather than throwing', () => {
    localStorage.setItem('polucz_tours', '{ broken')
    expect(tourStatus('arrival')).toBe('unseen')
    localStorage.setItem('polucz_tours', '["nope"]')
    expect(tourStatus('arrival')).toBe('unseen')
  })
})

describe('resuming', () => {
  // Backgrounding the app mid-tour is the common case: a phone call, a
  // notification. Coming back to step one would be worse than not resuming.
  it('resumes where it left off', () => {
    saveTourStep('arrival', 4)
    expect(tourStep('arrival')).toBe(4)
    expect(tourStatus('arrival')).toBe('unseen')
  })

  it('forgets the step once the tour is over', () => {
    saveTourStep('arrival', 4)
    finishTour('arrival', 'done')
    expect(tourStep('arrival')).toBe(0)
  })
})

describe('shouldOfferTour', () => {
  // The rule that stops a tour of an empty page, which would teach nothing and
  // spend the one moment someone was willing to be taught.
  it('does not offer when the page has nothing to demonstrate', () => {
    expect(shouldOfferTour('flashcards', false)).toBe(false)
  })

  it('offers an unseen tour when there is something to show', () => {
    expect(shouldOfferTour('flashcards', true)).toBe(true)
  })

  it('never offers again once done or skipped', () => {
    finishTour('flashcards', 'skipped')
    expect(shouldOfferTour('flashcards', true)).toBe(false)
    finishTour('quiz', 'done')
    expect(shouldOfferTour('quiz', true)).toBe(false)
  })

  it('offers again after a reset, which is what Help does', () => {
    finishTour('quiz', 'done')
    resetTour('quiz')
    expect(tourStatus('quiz')).toBe('unseen')
    expect(shouldOfferTour('quiz', true)).toBe(true)
  })
})

describe('subscribers', () => {
  it('are told when anything changes, and stop when unsubscribed', () => {
    let n = 0
    const stop = subscribeTours(() => { n++ })
    finishTour('arrival', 'done')
    saveTourStep('quiz', 2)
    expect(n).toBe(2)
    stop()
    finishTour('audio', 'done')
    expect(n).toBe(2)
  })
})
