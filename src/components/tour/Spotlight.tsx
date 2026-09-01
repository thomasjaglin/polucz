import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import GlassPane from '../GlassPane'
import { getAnchor, type AnchorName } from './anchors'

// The dim-everything-but-this overlay.
//
// Built from four panels around the highlighted rectangle rather than one panel
// with a hole punched in it. The gap between them is genuinely empty, so taps
// land on the real control underneath while the panels swallow everything else —
// which is the behaviour the spec asks for: during a step, only the highlighted
// thing responds. A mask or a box-shadow ring would dim correctly but would
// still eat the tap.

const DIM = 'rgba(0,0,0,0.55)'
const PAD = 8

interface Rect { top: number; left: number; width: number; height: number }

interface Props {
  anchor: AnchorName
  /** What the step says. Kept to a sentence — this is a coach mark, not a page. */
  text: string
  /** Step n of m, shown so the user knows how much is left. */
  progress: { step: number; total: number }
  /** Advance when the user does the thing. Absent for steps with no target action. */
  onNext?: () => void
  onSkip: () => void
  /** Label for the advance button; omit to require the real gesture instead. */
  nextLabel?: string
}

export default function Spotlight({ anchor, text, progress, onNext, onSkip, nextLabel }: Props) {
  const [rect, setRect] = useState<Rect | null>(null)

  // The anchor can arrive late (page transition, modal open) and can move
  // (scroll, keyboard, layout settling), so this re-measures on a frame loop
  // rather than once on mount.
  // A new step may be pointing below the fold; scroll it into view once, then
  // leave the user alone so the page does not fight their own scrolling.
  useEffect(() => {
    let tries = 0
    const id = setInterval(() => {
      const el = getAnchor(anchor)
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        clearInterval(id)
      } else if (++tries > 40) {
        clearInterval(id)
      }
    }, 50)
    return () => clearInterval(id)
  }, [anchor])

  useEffect(() => {
    let raf = 0
    const measure = () => {
      const el = getAnchor(anchor)
      if (el) {
        const b = el.getBoundingClientRect()
        setRect(prev => {
          const next = { top: b.top - PAD, left: b.left - PAD, width: b.width + PAD * 2, height: b.height + PAD * 2 }
          if (prev && Math.abs(prev.top - next.top) < 0.5 && Math.abs(prev.left - next.left) < 0.5
              && Math.abs(prev.width - next.width) < 0.5 && Math.abs(prev.height - next.height) < 0.5) return prev
          return next
        })
      } else {
        setRect(null)
      }
      raf = requestAnimationFrame(measure)
    }
    raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [anchor])

  // Until the anchor exists, dim the whole screen rather than flashing an
  // un-dimmed page: the step is still running, it just cannot point yet.
  const r = rect
  const below = r ? r.top + r.height : 0

  // The prompt follows the highlight, and the highlight moves when the user
  // scrolls — so without clamping, scrolling a long card carries the prompt off
  // the screen and the step becomes unreadable. Preference order: under the
  // highlight, then above it, then wherever it still fits; always on screen.
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [cardH, setCardH] = useState(0)
  useEffect(() => {
    let raf = 0
    const measure = () => {
      const h = cardRef.current?.offsetHeight ?? 0
      setCardH(prev => (Math.abs(prev - h) < 0.5 ? prev : h))
      raf = requestAnimationFrame(measure)
    }
    raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [])

  const MARGIN = 16
  const GAP = 20
  const vh = typeof window === 'undefined' ? 0 : window.innerHeight
  let top: number
  if (!r) {
    top = vh - cardH - 104
  } else if (below + GAP + cardH + MARGIN <= vh) {
    top = below + GAP
  } else if (r.top - GAP - cardH >= MARGIN) {
    top = r.top - GAP - cardH
  } else {
    // Neither side fits — sit against the bottom edge of the highlight and let
    // the clamp below keep it in view.
    top = below + GAP
  }
  top = Math.max(MARGIN, Math.min(top, vh - cardH - MARGIN))

  return (
    <div className="pointer-events-none fixed inset-0 z-[200]">
      {/* Four dim panels. Each blocks taps; the hole between them does not. */}
      {r ? (
        <>
          <div className="pointer-events-auto absolute inset-x-0 top-0" style={{ height: Math.max(0, r.top), background: DIM }} onClick={e => e.stopPropagation()} />
          <div className="pointer-events-auto absolute inset-x-0 bottom-0" style={{ top: below, background: DIM }} onClick={e => e.stopPropagation()} />
          <div className="pointer-events-auto absolute" style={{ top: r.top, left: 0, width: Math.max(0, r.left), height: r.height, background: DIM }} onClick={e => e.stopPropagation()} />
          <div className="pointer-events-auto absolute" style={{ top: r.top, left: r.left + r.width, right: 0, height: r.height, background: DIM }} onClick={e => e.stopPropagation()} />
          {/* Ring around the hole, purely decorative. */}
          <div className="absolute rounded-[20px] ring-2 ring-accent/70" style={{ top: r.top, left: r.left, width: r.width, height: r.height }} />
        </>
      ) : (
        <div className="pointer-events-auto absolute inset-0" style={{ background: DIM }} />
      )}

      <motion.div
        key={`${anchor}-${progress.step}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.33, 1, 0.68, 1] }}
        ref={cardRef}
        className="pointer-events-auto absolute inset-x-4 overflow-hidden rounded-[28px] border border-ink/10 glass-raise"
        style={{ top }}
      >
        <GlassPane borderRadius={28} className="absolute inset-0 z-0 rounded-[28px] bg-surface/80" />
        <div className="relative z-10 p-5">
        <p className="font-instrument text-[15px] leading-relaxed text-ink/90">{text}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="font-instrument text-[12px] font-medium tabular-nums ink-tertiary">
            {progress.step} of {progress.total}
          </span>
          <div className="flex items-center gap-3">
            {/* Skip is live on every step. A guided sequence you cannot leave is
                worse than no guidance. */}
            <button onClick={onSkip} className="font-instrument text-[13px] ink-tertiary underline underline-offset-4">
              Skip
            </button>
            {onNext && nextLabel && (
              <button
                onClick={onNext}
                className="rounded-full border border-accent/30 bg-accent/[0.14] px-5 py-2 font-instrument text-[14px] font-medium text-accent shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]"
              >
                {nextLabel}
              </button>
            )}
          </div>
        </div>
        </div>
      </motion.div>
    </div>
  )
}
