// Light/dark theme.
//
// One class on <html> drives everything: the --ink-rgb channels that every
// foreground colour is built from, the page background, and the light-mode
// glass rules in index.css. Nothing re-renders on switch — it's pure CSS.
//
// Two ideas that are easy to conflate:
//
//   ThemePreference  what the user asked for — 'system', 'light' or 'dark'
//   Theme            what is actually on screen — 'light' or 'dark'
//
// They differ only under 'system', where the phone decides and can change its
// mind while the app is open (a schedule, sunset, battery saver). So 'system'
// is not a value that gets resolved once at launch; it is a subscription.

/** What is actually rendered. */
export type Theme = 'dark' | 'light'
/** What the user asked for. */
export type ThemePreference = Theme | 'system'

const KEY = 'polucz_theme'
const listeners = new Set<(t: Theme) => void>()

const query = () =>
  typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null

/** What the phone currently prefers. Dark when it will not say. */
function systemTheme(): Theme {
  const q = query()
  if (!q) return 'dark'
  return q.matches ? 'dark' : 'light'
}

/**
 * Absence means 'system'.
 *
 * That is what makes the migration free: the old build only ever wrote this key
 * when someone picked a theme in settings, so anyone who never touched it has
 * nothing stored and now follows their phone — which is what they would have
 * chosen. Anyone who did pick keeps their choice.
 */
export function getThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(KEY)
    return raw === 'light' || raw === 'dark' ? raw : 'system'
  } catch {
    return 'system'
  }
}

/** The theme to actually paint, with the preference resolved. */
export function getTheme(): Theme {
  const pref = getThemePreference()
  return pref === 'system' ? systemTheme() : pref
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('theme-light', theme === 'light')
}

export function setThemePreference(pref: ThemePreference) {
  try {
    // 'system' is stored as the absence of a value rather than as the string
    // "system", so there is exactly one representation of "no choice made" and
    // getThemePreference cannot disagree with itself.
    if (pref === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, pref)
  } catch { /* ignore */ }
  const theme = getTheme()
  applyTheme(theme)
  listeners.forEach(fn => fn(theme))
}

export function subscribeTheme(fn: (t: Theme) => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/**
 * Called before React mounts so the first paint is already in the right theme —
 * otherwise a light-mode user gets a dark flash on every launch.
 *
 * Also starts following the phone. The listener stays attached for the life of
 * the app and simply does nothing while an explicit preference is set, which is
 * cheaper than attaching and detaching it as the preference changes.
 */
export function initTheme() {
  applyTheme(getTheme())

  const q = query()
  if (!q) return
  const onChange = () => {
    if (getThemePreference() !== 'system') return
    const theme = getTheme()
    applyTheme(theme)
    listeners.forEach(fn => fn(theme))
  }
  // Safari below 14 only has the deprecated form; Android's WebView has had
  // addEventListener for years, but the fallback costs one line.
  if (typeof q.addEventListener === 'function') q.addEventListener('change', onChange)
  else q.addListener(onChange)
}
