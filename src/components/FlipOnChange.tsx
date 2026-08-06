import { useEffect, useRef, type ReactNode } from 'react'
import { motion, useMotionValue, animate } from 'framer-motion'

// Folds its children edge-on and back whenever `trigger` changes — the same
// half-fold the flashcard uses when hard mode toggles. Purely visual (no content
// swap); used to echo that flip on the group-menu cards. `delay` staggers a
// cascade across a list.
export default function FlipOnChange({
  trigger, delay = 0, className, children,
}: { trigger: unknown; delay?: number; className?: string; children: ReactNode }) {
  const rotateY = useMotionValue(0)
  const prev = useRef(trigger)
  const mounted = useRef(false)

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; prev.current = trigger; return }
    if (prev.current === trigger) return
    prev.current = trigger
    const fold = () => {
      animate(rotateY, 90, { duration: 0.16, ease: 'easeIn', onComplete: () => {
        rotateY.set(-90)
        animate(rotateY, 0, { duration: 0.16, ease: 'easeOut' })
      } })
    }
    let t: ReturnType<typeof setTimeout> | null = null
    if (delay) t = setTimeout(fold, delay * 1000)
    else fold()
    return () => { if (t) clearTimeout(t) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])

  return (
    <motion.div style={{ rotateY, transformPerspective: 1000 }} className={className}>
      {children}
    </motion.div>
  )
}
