import { motion, useReducedMotion } from 'framer-motion'

// Ambient golden light rays BEHIND a mastered card. Two counter-rotating conic
// ray fans (radially masked so they fade outward) spin in as the modal opens and
// then keep turning for as long as it stays open — the parts beyond the card's
// edges read as a slow sunburst around it. Sits behind the card in DOM order, is
// pointer-events-none, and blends as light (screen) over the dark scrim. Under
// reduced motion it degrades to a static gold glow (no rotation).

// closest-side so the fade always completes before the (square) div's edges —
// on a rectangle a farthest-corner circle leaves a hard cut on the narrow axis.
const MASK = 'radial-gradient(circle closest-side at center, #000 22%, rgba(0,0,0,0.5) 48%, transparent 80%)'

const RAYS_A =
  'repeating-conic-gradient(from 0deg, rgba(255,208,115,0) 0deg, rgba(255,208,115,0.34) 7deg, rgba(255,208,115,0) 15deg, rgba(255,208,115,0) 28deg)'
const RAYS_B =
  'repeating-conic-gradient(from 12deg, rgba(255,236,185,0) 0deg, rgba(255,236,185,0.22) 5deg, rgba(255,236,185,0) 11deg, rgba(255,236,185,0) 40deg)'

export default function MasteredLightBands() {
  const reduce = useReducedMotion()

  if (reduce) {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 w-[200%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle closest-side, rgba(255,210,120,0.22) 0%, transparent 70%)', mixBlendMode: 'screen' }}
      />
    )
  }

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible">
      {/* Wider, warmer fan — clockwise. The -50% centering is applied as motion
          values (x/y), not Tailwind classes, so it composes with the animated
          rotate/scale instead of being overwritten by them. */}
      <motion.div
        className="absolute left-1/2 top-1/2 w-[220%] aspect-square"
        style={{ background: RAYS_A, WebkitMaskImage: MASK, maskImage: MASK, mixBlendMode: 'screen' }}
        initial={{ opacity: 0, scale: 0.75, rotate: 0, x: '-50%', y: '-50%' }}
        animate={{ opacity: 0.9, scale: 1, rotate: 360, x: '-50%', y: '-50%' }}
        transition={{
          opacity: { duration: 0.9, ease: 'easeOut' },
          scale: { duration: 1.0, ease: 'easeOut' },
          rotate: { duration: 46, ease: 'linear', repeat: Infinity },
        }}
      />
      {/* Finer, whiter fan — counter-rotating and slower, for a shifting shimmer. */}
      <motion.div
        className="absolute left-1/2 top-1/2 w-[200%] aspect-square"
        style={{ background: RAYS_B, WebkitMaskImage: MASK, maskImage: MASK, mixBlendMode: 'screen' }}
        initial={{ opacity: 0, scale: 0.8, rotate: 0, x: '-50%', y: '-50%' }}
        animate={{ opacity: 0.7, scale: 1, rotate: -360, x: '-50%', y: '-50%' }}
        transition={{
          opacity: { duration: 1.1, ease: 'easeOut' },
          scale: { duration: 1.1, ease: 'easeOut' },
          rotate: { duration: 72, ease: 'linear', repeat: Infinity },
        }}
      />
    </div>
  )
}
