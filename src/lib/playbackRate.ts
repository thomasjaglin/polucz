import { useSyncExternalStore } from 'react'

// Global TTS playback speed, persisted across sessions. Applied to every audio
// clip (audio playback page, flashcards, modal speaker). Browsers time-stretch
// with preservesPitch, so slower/faster keeps the voice natural.

const KEY = 'polucz_playback_rate'
export const RATE_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5] as const

function load(): number {
  const raw = Number(localStorage.getItem(KEY))
  return (RATE_OPTIONS as readonly number[]).includes(raw) ? raw : 1
}

let rate: number = load()
const listeners = new Set<() => void>()

export function getPlaybackRate(): number { return rate }

export function setPlaybackRate(r: number) {
  if (r === rate) return
  rate = r
  try { localStorage.setItem(KEY, String(r)) } catch { /* ignore */ }
  listeners.forEach(l => l())
}

// Advance to the next option (wraps around); returns the new rate.
export function cyclePlaybackRate(): number {
  const opts = RATE_OPTIONS as readonly number[]
  const next = opts[(opts.indexOf(rate) + 1) % opts.length]
  setPlaybackRate(next)
  return next
}

export function subscribeRate(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function usePlaybackRate(): number {
  return useSyncExternalStore(subscribeRate, getPlaybackRate)
}
