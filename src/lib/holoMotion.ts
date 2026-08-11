// Drives the mastered-card holographic highlight from the device's TILT (phone)
// or the pointer position (desktop) instead of playing on a loop — the sheen,
// glitter and edge light follow how you hold the phone, like a real foil card.
// It writes smoothed CSS variables on :root that the .holo-* layers read:
//   --holo-shift       sheen / glitter horizontal position (0%–100%)
//   --holo-edge-angle  where the bright point sits on the border ring
//   --holo-hue         hue-rotate applied to the foil
// Nothing animates while the phone is still.

const EASE = 0.16                 // per-frame easing toward the target (0..1)
let installed = false
let tX = 0.5, cX = 0.5            // horizontal axis (gamma / pointer x), 0..1
let tH = 0.5, cH = 0.5            // hue axis (beta / pointer y), 0..1
let rafId: number | null = null
let usingTilt = false            // once device tilt fires, ignore the pointer

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

function apply() {
  const s = document.documentElement.style
  s.setProperty('--holo-shift', (cX * 100).toFixed(1) + '%')   // X axis (gamma / pointer x)
  s.setProperty('--holo-y', (cH * 100).toFixed(1) + '%')       // Y axis (beta / pointer y)
  s.setProperty('--holo-edge-angle', (cX * 360).toFixed(0) + 'deg')
  s.setProperty('--holo-hue', ((cH - 0.5) * 240).toFixed(0) + 'deg')
}

function tick() {
  cX += (tX - cX) * EASE
  cH += (tH - cH) * EASE
  apply()
  if (Math.abs(tX - cX) < 0.0008 && Math.abs(tH - cH) < 0.0008) {
    cX = tX; cH = tH; apply()
    rafId = null            // settled — nothing moves until the next input
    return
  }
  rafId = requestAnimationFrame(tick)
}

function kick() { if (rafId == null) rafId = requestAnimationFrame(tick) }

export function initHoloMotion() {
  if (installed) return
  installed = true
  apply()

  // Device tilt (Android WebView fires this without a permission prompt; desktop
  // supports the API but never fires it, so it harmlessly no-ops there). gamma is
  // left/right lean, beta is front/back.
  if (typeof window !== 'undefined' && 'ondeviceorientation' in window) {
    window.addEventListener('deviceorientation', e => {
      if (e.gamma == null && e.beta == null) return
      usingTilt = true
      tX = clamp01(((e.gamma ?? 0) + 40) / 80)   // -40°..40° → 0..1
      tH = clamp01(((e.beta ?? 45) - 15) / 75)   //  15°..90° → 0..1
      kick()
    }, { passive: true })
  }

  // Desktop fallback so the effect is visible/testable without a gyroscope.
  // Suppressed once real tilt data arrives (a phone touch also fires pointers).
  window.addEventListener('pointermove', e => {
    if (usingTilt) return
    tX = clamp01(e.clientX / window.innerWidth)
    tH = clamp01(e.clientY / window.innerHeight)
    kick()
  }, { passive: true })
}
