import { useSyncExternalStore } from 'react'

// Global toast store — a stack of transient messages shown at the top of the
// screen. Any component (or non-React code) can call pushToast(); a single
// <Toaster> rendered in App subscribes and renders them.

export interface Toast { id: number; text: string }

let toasts: Toast[] = []
let counter = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

const DISMISS_MS = 2500

export function pushToast(text: string) {
  const id = ++counter
  toasts = [...toasts, { id, text }]
  emit()
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id)
    emit()
  }, DISMISS_MS)
}

function getSnapshot() {
  return toasts
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
