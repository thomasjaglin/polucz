// Tier-1 glass scroll perf: toggles `html.is-scrolling` while ANY scroll
// container is actively scrolling, removing it shortly after motion stops.
//
// In css glass mode the stylesheet uses that class to swap the per-frame
// backdrop-blur (the only remaining scroll cost, since css glass is already
// attached to each element) for a cheap flat translucent fill during motion —
// the eye can't resolve blur detail mid-scroll anyway — then snaps the full
// frosted look back the instant scrolling settles. Scoped to css mode in CSS,
// so webgl/svg modes are unaffected.

let installed = false
let timer: number | null = null

// How long after the last scroll event to consider scrolling "stopped". Long
// enough to span momentum-fling gaps, short enough that the blur returns
// promptly once the list is at rest.
const SETTLE_MS = 140

export function initScrollGlass() {
  if (installed || typeof window === 'undefined') return
  installed = true
  const root = document.documentElement

  const stop = () => {
    root.classList.remove('is-scrolling')
    timer = null
  }

  // Capture so it catches scroll from any nested scroller (scroll doesn't
  // bubble); passive so it never blocks the compositor-driven scroll.
  window.addEventListener(
    'scroll',
    () => {
      if (!root.classList.contains('is-scrolling')) root.classList.add('is-scrolling')
      if (timer !== null) clearTimeout(timer)
      timer = window.setTimeout(stop, SETTLE_MS)
    },
    { capture: true, passive: true },
  )
}
