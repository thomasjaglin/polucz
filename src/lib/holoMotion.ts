// Speeds up the mastered-card holographic animations briefly on scroll or
// device movement, then decays back to the slow resting pace. Toggles a
// `holo-fast` class on the document root; the CSS keys the faster durations off
// it (see index.css). Installed once from App.

let installed = false
let decayTimer: number | null = null

function boost() {
  const root = document.documentElement
  if (!root.classList.contains('holo-fast')) root.classList.add('holo-fast')
  if (decayTimer) clearTimeout(decayTimer)
  decayTimer = window.setTimeout(() => {
    root.classList.remove('holo-fast')
    decayTimer = null
  }, 700)
}

export function initHoloMotion() {
  if (installed) return
  installed = true

  // Page content scrolls inside an overflow container, and scroll events don't
  // bubble — capture on document to catch it from any scroller.
  document.addEventListener('scroll', boost, { capture: true, passive: true })

  // Device movement (Android WebView fires devicemotion without a permission
  // prompt; desktop/unsupported simply never triggers this path). Threshold on
  // rotation rate so resting gravity / tiny jitter doesn't keep it always-on.
  if (typeof window !== 'undefined' && 'ondevicemotion' in window) {
    let last = 0
    window.addEventListener('devicemotion', (e) => {
      const r = e.rotationRate
      if (!r) return
      const mag = Math.abs(r.alpha ?? 0) + Math.abs(r.beta ?? 0) + Math.abs(r.gamma ?? 0)
      const now = performance.now()
      if (mag > 60 && now - last > 120) { last = now; boost() }
    }, { passive: true })
  }
}
