import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// A one-shot celebration that plays when a MASTERED word's modal opens: a warm
// radial light bloom fills and overflows the whole card while iridescent star
// particles emanate from around the card's perimeter and fly outward past its
// edges (so they read to the sides / top / bottom, not on top of the content).
// Purely decorative + pointer-events-none, GPU-only (transform/opacity), and
// skipped under reduced motion. It plays once because the modal mounts fresh on
// each open. The host div is `absolute inset-0` over the card with overflow
// visible, so percentages below are relative to the card box.
//
// The stars carry `.holo-icon` — the same white + iridescent shine (and crisp
// black outline) as the mastered-card star/tick icons — so the burst matches the
// card. Each star's rotation rotates its clipped gradient too, varying the sheen.

export default function MasteredBurst() {
  const reduce = useReducedMotion()

  // Randomised once per mount: stars spread around an ellipse near the card's
  // edge (startR % of the card box, so it follows the card's tall aspect) and
  // then travel further outward along the same angle, spilling past the edges.
  const stars = useMemo(() => {
    const N = 22
    return Array.from({ length: N }, (_, i) => {
      const angle = (i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.28
      const startR = 40 + Math.random() * 9          // % from centre → near the edge
      const travel = 70 + Math.random() * 110        // px outward beyond the edge
      const size = 11 + Math.random() * 15
      return {
        id: i,
        leftPct: 50 + Math.cos(angle) * startR,
        topPct: 50 + Math.sin(angle) * startR,
        dx: Math.cos(angle) * travel,
        dy: Math.sin(angle) * travel,
        size,
        delay: Math.random() * 0.1,
        rot: (Math.random() - 0.5) * 200,
        dur: 0.8 + Math.random() * 0.3,
      }
    })
  }, [])

  if (reduce) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-visible">
      {/* Warm light bloom — an ellipse that fills the whole card and spills a
          little past every edge. */}
      <motion.div
        className="absolute inset-[-12%] rounded-[48px]"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(255,220,150,0.5) 0%, rgba(255,180,230,0.22) 45%, transparent 72%)',
        }}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: [0, 0.9, 0], scale: [0.85, 1.06, 1.14] }}
        transition={{ duration: 1.0, ease: 'easeOut', times: [0, 0.3, 1] }}
      />
      {/* Star particles bursting outward from around the perimeter. */}
      {stars.map(s => (
        <motion.span
          key={s.id}
          className="holo-icon absolute leading-none"
          style={{
            left: `${s.leftPct}%`,
            top: `${s.topPct}%`,
            marginLeft: -s.size / 2,
            marginTop: -s.size / 2,
            fontSize: s.size,
          }}
          initial={{ x: 0, y: 0, scale: 0, opacity: 0, rotate: 0 }}
          animate={{ x: s.dx, y: s.dy, scale: [0, 1.2, 0.4], opacity: [0, 1, 0], rotate: s.rot }}
          transition={{ duration: s.dur, delay: s.delay, ease: [0.22, 1, 0.36, 1] }}
        >
          ★
        </motion.span>
      ))}
    </div>
  )
}
