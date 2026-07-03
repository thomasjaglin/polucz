// Which renderer paints the liquid glass. See docs/liquid-glass-webgl-plan.md.
//
// - 'svg'   — Chromium: SVG feDisplacementMap alongside backdrop-filter.
//             Refracts real DOM, so it stays the preferred path where it works.
// - 'webgl' — Safari/Firefox: a WebGL2 canvas renders the background and the
//             glass surfaces itself (refracts the background layer only).
// - 'css'   — no WebGL2 (or context lost): plain backdrop-filter blur.

export type GlassMode = 'svg' | 'webgl' | 'css'

let currentMode: GlassMode | null = null

function detect(): GlassMode {
  const q = new URLSearchParams(window.location.search).get('glass')
  if (q === 'svg' || q === 'webgl' || q === 'css') return q

  // Chromium reliably composites `filter: url(#…)` together with
  // backdrop-filter on the same element; Safari and Firefox do not.
  const isChromium = navigator.userAgent.includes('Chrome/') || 'chrome' in window
  if (isChromium) return 'svg'

  const canvas = document.createElement('canvas')
  return canvas.getContext('webgl2') ? 'webgl' : 'css'
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
