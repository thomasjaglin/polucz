import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getTheme, getThemePreference, setThemePreference, initTheme, subscribeTheme,
} from './theme'

// jsdom ships no matchMedia, so the phone's preference is stubbed here. The
// listener set is real: change() is what a phone flipping to dark at sunset does.
let systemPrefersDark = false
const changeListeners = new Set<() => void>()

function stubMatchMedia() {
  vi.stubGlobal('matchMedia', (q: string) => ({
    media: q,
    get matches() { return q.includes('dark') && systemPrefersDark },
    addEventListener: (_: string, fn: () => void) => { changeListeners.add(fn) },
    removeEventListener: (_: string, fn: () => void) => { changeListeners.delete(fn) },
    addListener: (fn: () => void) => { changeListeners.add(fn) },
    removeListener: (fn: () => void) => { changeListeners.delete(fn) },
  }))
}
const systemChangesTo = (dark: boolean) => {
  systemPrefersDark = dark
  changeListeners.forEach(fn => fn())
}
const isLightOnScreen = () => document.documentElement.classList.contains('theme-light')

beforeEach(() => {
  localStorage.clear()
  changeListeners.clear()
  systemPrefersDark = false
  document.documentElement.classList.remove('theme-light')
  stubMatchMedia()
})

describe('the preference', () => {
  // The old build only wrote this key when someone picked a theme, so an
  // absent value is exactly "never chose" — which is what makes following the
  // phone the correct default rather than a behaviour change imposed on people.
  it('defaults to system when nothing is stored', () => {
    expect(getThemePreference()).toBe('system')
  })

  it('keeps an explicit choice made in an older build', () => {
    localStorage.setItem('polucz_theme', 'light')
    expect(getThemePreference()).toBe('light')
    expect(getTheme()).toBe('light')
  })

  it('stores system as the absence of a value, not the word "system"', () => {
    setThemePreference('dark')
    expect(localStorage.getItem('polucz_theme')).toBe('dark')
    setThemePreference('system')
    expect(localStorage.getItem('polucz_theme')).toBeNull()
    expect(getThemePreference()).toBe('system')
  })

  it('ignores a stored value it does not recognise', () => {
    localStorage.setItem('polucz_theme', 'sepia')
    expect(getThemePreference()).toBe('system')
  })
})

describe('resolving to what is painted', () => {
  it('follows the phone under system', () => {
    systemPrefersDark = true
    expect(getTheme()).toBe('dark')
    systemPrefersDark = false
    expect(getTheme()).toBe('light')
  })

  it('ignores the phone once the user has chosen', () => {
    setThemePreference('dark')
    systemPrefersDark = false          // phone says light
    expect(getTheme()).toBe('dark')    // user said dark
  })

  it('paints the class on apply', () => {
    setThemePreference('light')
    expect(isLightOnScreen()).toBe(true)
    setThemePreference('dark')
    expect(isLightOnScreen()).toBe(false)
  })
})

describe('following the phone while the app is open', () => {
  it('repaints when the phone changes and the user has not chosen', () => {
    systemPrefersDark = true
    initTheme()
    expect(isLightOnScreen()).toBe(false)
    systemChangesTo(false)
    expect(isLightOnScreen()).toBe(true)
  })

  it('leaves an explicit choice alone when the phone changes', () => {
    setThemePreference('dark')
    initTheme()
    systemChangesTo(false)
    expect(isLightOnScreen()).toBe(false)
  })

  it('tells subscribers what it switched to', () => {
    const seen: string[] = []
    const stop = subscribeTheme(t => seen.push(t))
    initTheme()
    systemChangesTo(true)
    systemChangesTo(false)
    stop()
    systemChangesTo(true)              // no longer listening
    expect(seen).toEqual(['dark', 'light'])
  })
})
