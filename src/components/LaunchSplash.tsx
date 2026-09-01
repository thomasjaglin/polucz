import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

/**
 * Carries the launch on from where the system splash stops.
 *
 * Android 12+ draws its own splash and gives you two knobs: one flat background
 * colour, and an icon masked to a circle. No gradient, no full bleed. So this
 * picks up at exactly that frame — same colour, a 192dp badge in the middle,
 * which is what the system was showing — and then does what the system cannot:
 * the badge opens out until its gradient is the whole screen, holds the mark,
 * and dissolves into the app.
 *
 * Because the handoff is a continuation rather than a second splash, the system
 * side is left static and unheld: nothing is delayed waiting on it, and the
 * motion all happens here where it can be timed properly.
 */

// The system splash's icon is a circle of the inner 192dp of a 288dp canvas,
// and a CSS pixel is a dp in the WebView, so this starts life the same size.
const BADGE = 192
const MARK = Math.round(BADGE * 0.672)   // the mark fills 129 of 192 in the badge

const BLOOM_MS = 620
const HOLD_MS = 420
const FADE_MS = 420

export default function LaunchSplash({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion()
  const [phase, setPhase] = useState<'bloom' | 'out'>('bloom')

  useEffect(() => {
    // Reduced motion still gets the screen, just without the expansion.
    const total = reduced ? HOLD_MS : BLOOM_MS + HOLD_MS
    const t = setTimeout(() => setPhase('out'), total)
    return () => clearTimeout(t)
  }, [reduced])

  // Scale needed for a BADGE-wide circle to cover the viewport corner to corner.
  const cover = typeof window === 'undefined'
    ? 12
    : (Math.hypot(window.innerWidth, window.innerHeight) / BADGE) * 1.08

  return (
    <AnimatePresence onExitComplete={onDone}>
      {phase === 'bloom' && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden"
          style={{ background: 'var(--page-bg)' }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: FADE_MS / 1000, ease: 'easeIn' } }}
        >
          {/* The badge, opening out until its gradient is the background. Scale
              on a circle keeps it a circle, so this reads as one shape growing
              rather than a new layer being drawn. */}
          <motion.div
            aria-hidden
            className="absolute rounded-full"
            style={{
              width: BADGE,
              height: BADGE,
              background: 'radial-gradient(circle at 50% 45%, #621619 0%, #3A0D0F 45%, #140505 100%)',
            }}
            initial={{ scale: 1 }}
            animate={{ scale: reduced ? cover : [1, 1, cover] }}
            transition={reduced
              ? { duration: 0 }
              : { duration: BLOOM_MS / 1000, times: [0, 0.18, 1], ease: [0.23, 1, 0.32, 1] }}
          />
          {/* The mark holds its size while the ground opens behind it, so the
              eye stays on the logo rather than being pulled outward with it. */}
          <motion.img
            src="/logo-mark.svg"
            alt=""
            className="relative"
            style={{ width: MARK, height: MARK }}
            initial={{ opacity: 1, scale: 1 }}
            animate={{ scale: reduced ? 1 : [1, 1, 1.16] }}
            transition={reduced
              ? { duration: 0 }
              : { duration: BLOOM_MS / 1000, times: [0, 0.18, 1], ease: [0.23, 1, 0.32, 1] }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
