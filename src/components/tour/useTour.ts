import { useCallback, useEffect, useState } from 'react'
import { getAnchor } from './anchors'
import { ARRIVAL_STEPS, type TourEvent, type TourStep } from './steps'
import { finishTour, saveTourStep, tourStep, type TourId } from '../../lib/tourState'

const STEPS: Partial<Record<TourId, TourStep[]>> = {
  arrival: ARRIVAL_STEPS,
}

export interface Tour {
  id: TourId | null
  step: TourStep | null
  progress: { step: number; total: number }
  /** True while any tour is running — screens use this to switch to fixtures. */
  active: boolean
  start: (id: TourId) => void
  skip: () => void
  next: () => void
  /** Screens report what the user did; the tour advances if it was waiting for it. */
  notify: (e: TourEvent) => void
}

export function useTour(): Tour {
  const [id, setId] = useState<TourId | null>(null)
  const [index, setIndex] = useState(0)

  const steps = id ? STEPS[id] ?? [] : []
  const step = steps[index] ?? null

  // Persist as we go, so backgrounding mid-tour resumes in place.
  useEffect(() => {
    if (id && index < steps.length) saveTourStep(id, index)
  }, [id, index, steps.length])

  const start = useCallback((next: TourId) => {
    setId(next)
    setIndex(tourStep(next))
  }, [])

  const end = useCallback((how: 'done' | 'skipped') => {
    setId(prev => { if (prev) finishTour(prev, how); return null })
    setIndex(0)
  }, [])

  const advance = useCallback(() => {
    setIndex(i => {
      const list = id ? STEPS[id] ?? [] : []
      if (i + 1 >= list.length) { end('done'); return 0 }
      return i + 1
    })
  }, [id, end])

  // A step marked skipIfMissing applies only to some cards — comparatives are on
  // an adjective and not on a noun.
  //
  // Resolved BEFORE the step is handed out, never after: showing "Adjectives
  // also compare" for a moment on a noun and then yanking it away is worse than
  // a slightly later prompt. The anchor is usually already mounted when the step
  // begins, so this normally settles on the first check with nothing on screen
  // in between; the poll only covers a slow mount.
  const [resolved, setResolved] = useState(true)
  useEffect(() => {
    if (!step?.skipIfMissing) { setResolved(true); return }
    if (getAnchor(step.anchor)) { setResolved(true); return }
    setResolved(false)
    let tries = 0
    const timer = setInterval(() => {
      if (getAnchor(step.anchor)) { setResolved(true); clearInterval(timer); return }
      if (++tries >= 12) {
        clearInterval(timer)
        setResolved(true)
        setIndex(i => {
          const list = id ? STEPS[id] ?? [] : []
          return i + 1 >= list.length ? i : i + 1
        })
      }
    }, 25)
    return () => clearInterval(timer)
  }, [step, id])

  const notify = useCallback((e: TourEvent) => {
    // Only the step that is waiting for this event reacts to it, so a stray
    // action elsewhere cannot skip the user forward.
    setIndex(i => {
      const list = id ? STEPS[id] ?? [] : []
      if (list[i]?.advanceOn !== e) return i
      if (i + 1 >= list.length) { end('done'); return 0 }
      return i + 1
    })
  }, [id, end])

  return {
    id,
    // Withheld while a conditional step is still deciding, so nothing is drawn
    // that might be about to disappear.
    step: resolved ? step : null,
    progress: { step: Math.min(index + 1, steps.length), total: steps.length },
    active: id !== null,
    start,
    skip: () => end('skipped'),
    next: advance,
    notify,
  }
}
