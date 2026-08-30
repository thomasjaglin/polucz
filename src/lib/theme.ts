// Light/dark theme.
//
// One class on <html> drives everything: the --ink-rgb channels that every
// foreground colour is built from, the page background, and the light-mode
// glass rules in index.css. Nothing re-renders on switch — it's pure CSS.

export type Theme = 'dark' | 'light'

const KEY = 'polon_theme'
const listeners = new Set<(t: Theme) => void>()

export function getTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('theme-light', theme === 'light')
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme)
  } catch { /* ignore */ }
  applyTheme(theme)
  listeners.forEach(fn => fn(theme))
}

export function subscribeTheme(fn: (t: Theme) => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

// Called before React mounts so the first paint is already in the right theme —
// otherwise a light-mode user gets a dark flash on every launch.
export function initTheme() {
  applyTheme(getTheme())
}
