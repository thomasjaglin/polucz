import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// A one-shot celebration that plays when a MASTERED word's modal opens: a warm
// radial light bloom expands from the card centre while iridescent star
// particles explode outward and fade. Purely decorative + pointer-events-none,
// GPU-only (transform/opacity), and skipped entirely under reduced motion. It
// plays once because the modal mounts fresh on each open.

const STAR_COLORS = ['#ffe6b0', '#ffb8e6', '#b0dcff', '#bfffd6', '#ffffff']

export default function MasteredBurst() {
  const reduce = useReducedMotion()

  // Randomised once per mount: even ring of stars with jittered angle/distance.
  const stars = useMemo(() => {
    const N = 16
    return Array.from({ length: N }, (_, i) => {
      const angle = (i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.4
      const dist = 130 + Math.random() * 90
      return {
        id: i,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        size: 10 + Math.random() * 14,
        color: STAR_COLORS[i % STAR_COLORS.length],
        delay: Math.random() * 0.08,
        rot: (Math.random() - 0.5) * 200,
        dur: 0.75 + Math.random() * 0.25,
      }
    })
  }, [])

  if (reduce) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-visible">
      {/* Warm light bloom */}
      <motion.div
        className="absolute h-[320px] w-[320px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(255,220,150,0.55) 0%, rgba(255,180,230,0.28) 42%, transparent 70%)',
        }}
        initial={{ scale: 0.2, opacity: 0 }}
        animate={{ scale: [0.2, 1.3, 1.7], opacity: [0, 0.85, 0] }}
        transition={{ duration: 0.95, ease: 'easeOut', times: [0, 0.28, 1] }}
      />
      {/* Exploding star particles */}
      {stars.map(s => (
        <motion.span
          key={s.id}
          className="absolute leading-none"
          style={{ color: s.color, fontSize: s.size, textShadow: '0 0 6px currentColor' }}
          initial={{ x: 0, y: 0, scale: 0, opacity: 0, rotate: 0 }}
          animate={{ x: s.x, y: s.y, scale: [0, 1.2, 0.4], opacity: [0, 1, 0], rotate: s.rot }}
          transition={{ duration: s.dur, delay: s.delay, ease: [0.22, 1, 0.36, 1] }}
        >
          ★
        </motion.span>
      ))}
    </div>
  )
}
