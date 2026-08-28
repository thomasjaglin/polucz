// Which renderer paints the liquid glass. See docs/liquid-glass-webgl-plan.md.
//
// NOTE (css-glass-only branch): detect() is pinned to 'css' — see below.
// The other two modes are still fully wired and reachable via ?glass=.
//
// - 'svg'   — Chromium: SVG feDisplacementMap alongside backdrop-filter.
//             Refracts real DOM, so it stays the preferred path where it works.
// - 'webgl' — Safari/Firefox: a WebGL2 canvas renders the background and the
//             glass surfaces itself (refracts the background layer only).
// - 'css'   — no WebGL2 (or context lost): plain backdrop-filter blur.

export type GlassMode = 'svg' | 'webgl' | 'css'

let currentMode: GlassMode | null = null

// Chromium reliably composites `filter: url(#…)` together with
// backdrop-filter on the same element; Safari and Firefox do not.
export function isChromium(): boolean {
  return navigator.userAgent.includes('Chrome/') || 'chrome' in window
}

function detect(): GlassMode {
  const q = new URLSearchParams(window.location.search).get('glass')
  if (q === 'svg' || q === 'webgl' || q === 'css') return q

  // EXPERIMENT (this branch): 'css' everywhere, unconditionally — the point of
  // the branch is judging the whole app in the cheap painted-glass style the
  // vocab list already uses, and measuring what that buys on a real phone.
  //
  // This drops the GlassCanvas entirely (App only mounts it in webgl mode), so
  // the shader-only showcase effects go with it: the translate page's gradient
  // blob + disc and the logo refraction. Every page falls back to its DOM
  // gradient (see PageGradient) and every pane to backdrop-filter + the painted
  // rim in index.css. Nothing else regresses — each `mode === 'webgl'` check in
  // the app already has a working non-webgl branch.
  //
  // `?glass=webgl` and `?glass=svg` above still force the old renderers, but only
  // in a browser: the packaged Capacitor app loads https://localhost/ with no
  // query string and no address bar, so comparing modes on-device means a
  // rebuild (or a persisted dev toggle, which this branch doesn't add).
  return 'css'
}

export function getGlassMode(): GlassMode {
  if (currentMode === null) setGlassMode(detect())
  return currentMode!
}

// Also used by GlassCanvas to fall back to 'css' on WebGL context loss.
export function setGlassMode(mode: GlassMode) {
  currentMode = mode
  const cl = document.documentElement.classList
  cl.remove('glass-svg', 'glass-webgl', 'glass-css')
  cl.add(`glass-${mode}`)
}
