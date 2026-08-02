// Speeds up the mastered-card holographic animations on scroll / device
// movement — smoothly. It never touches animation-duration (which recomputes
// the phase and visibly jumps); instead it eases each running animation's
// playbackRate up on activity and back down to 1 when idle. The keyframes loop
// continuously; only their speed changes, so there's no reset.

const SELECTOR = '.holo-shimmer, .holo-glitter, .holo-edge'
const FAST_RATE = 3.2
const REST_RATE = 1
const IDLE_MS = 500        // ease back to rest this long after the last activity

let installed = false
let targetRate = REST_RATE
let currentRate = REST_RATE
let lastActivity = 0
let rafId: number | null = null

function apply(rate: number) {
  document.querySelectorAll<HTMLElement>(SELECTOR).forEach(el => {
    el.getAnimations().forEach(a => { a.playbackRate = rate })
  })
}

function tick() {
  if (performance.now() - lastActivity > IDLE_MS) targetRate = REST_RATE
  // Exponential ease toward the target rate — smooth acceleration/deceleration.
  currentRate += (targetRate - currentRate) * 0.1
  if (Math.abs(currentRate - targetRate) < 0.01) currentRate = targetRate
  apply(currentRate)
  if (currentRate !== REST_RATE || targetRate !== REST_RATE) {
    rafId = requestAnimationFrame(tick)
  } else {
    rafId = null   // settled at rest; new cards mount at playbackRate 1 already
  }
}

function boost() {
  lastActivity = performance.now()
  targetRate = FAST_RATE
  if (rafId == null) rafId = requestAnimationFrame(tick)
}

export function initHoloMotion() {
  if (installed) return
  installed = true

  // Page content scrolls inside an overflow container, and scroll events don't
  // bubble — capture on document to catch it from any scroller.
  document.addEventListener('scroll', boost, { capture: true, passive: true })

  // Device movement (Android WebView fires devicemotion without a permission
  // prompt; desktop/unsupported never triggers this path). Threshold on rotation
  // rate so resting gravity / tiny jitter doesn't keep it always-on.
  if (typeof window !== 'undefined' && 'ondevicemotion' in window) {
    window.addEventListener('devicemotion', (e) => {
      const r = e.rotationRate
      if (!r) return
      const mag = Math.abs(r.alpha ?? 0) + Math.abs(r.beta ?? 0) + Math.abs(r.gamma ?? 0)
      if (mag > 60) boost()
    }, { passive: true })
  }
}
