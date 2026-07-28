import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, useMotionValueEvent, animate, type MotionValue } from 'framer-motion'
import { tagGradients } from '../data/gradients'
import type { VocabEntry } from '../data/types'
import { getAllReviews, getReview, saveReview, initReview, resetDueReviews } from '../lib/reviewStorage'
import { getDueCards, applyEasy, applyHard, applyConquered, applyLapse } from '../lib/scheduler'
import { useTTS, type AudioState } from '../lib/useTTS'
import { pokeRenderer } from '../webgl/glassStore'
import GlassPane from './GlassPane'
import GlassButton from './GlassButton'
import { useDoubleTap } from '../hooks/useDoubleTap'
import { haptics } from '../lib/haptics'

// ─── Drag threshold (fraction of card width) ──────────────────────────────────

const THRESHOLD = 0.30

// ─── Flashcard UI ─────────────────────────────────────────────────────────────

interface CardProps {
  entry: VocabEntry
  x: MotionValue<number>
  hardMode: boolean
  onToggleHardMode: () => void
  onEasy: () => void
  onHard: () => void
  onConquered: () => void
  onLapse: () => void
  isConquering: boolean
  revealed: boolean
  onReveal: () => void
  ttsState: AudioState
  onReplay: () => void
  onOpenModal?: (entry: VocabEntry) => void
}

function FlashCard({ entry, x, hardMode, onToggleHardMode, onEasy, onHard, onConquered, onLapse, isConquering, revealed, onReveal, ttsState, onReplay, onOpenModal }: CardProps) {
  const rotate = useTransform(x, [-300, 0, 300], [-18, 0, 18])
  const doubleTap = useDoubleTap(useCallback(() => { onOpenModal?.(entry) }, [onOpenModal, entry]))

  const cardRef = useRef<HTMLDivElement>(null)
  const rotationJustFired = useRef(false)
  const rotateYVal = useMotionValue(0)
  // Lags behind hardMode by one animation cycle so content swaps at the midpoint
  const [displayHardMode, setDisplayHardMode] = useState(hardMode)

  // Fold-swap-unfold when hardMode prop changes
  useEffect(() => {
    if (displayHardMode === hardMode) return
    animate(rotateYVal, 90, {
      duration: 0.18,
      ease: 'easeIn',
      onComplete: () => {
        setDisplayHardMode(hardMode)
        rotateYVal.set(-90)
        animate(rotateYVal, 0, { duration: 0.18, ease: 'easeOut' })
      },
    })
  }, [hardMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Two-finger rotation gesture — native listeners required for passive:false
  useEffect(() => {
    const el = cardRef.current
    if (!el) return

    let startAngle: number | null = null
    let startX: number | null = null
    let committed = false

    const getAngle = (t: TouchList) =>
      Math.atan2(t[1].clientY - t[0].clientY, t[1].clientX - t[0].clientX) * (180 / Math.PI)
    const getX = (t: TouchList) => (t[0].clientX + t[1].clientX) / 2

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      startAngle = getAngle(e.touches)
      startX = getX(e.touches)
      committed = false
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || startAngle === null || startX === null || committed) return
      e.preventDefault()
      // A horizontal drag of the two fingers isn't a rotation intent — bail
      // so this doesn't fight the swipe-to-rate gesture.
      if (Math.abs(getX(e.touches) - startX) > 20) return
      const delta = getAngle(e.touches) - startAngle
      const norm = ((delta + 180) % 360) - 180
      if (Math.abs(norm) > 45) {
        committed = true
        rotationJustFired.current = true
        haptics.swipeRight()
        onToggleHardMode()
      }
    }

    const onTouchEnd = () => {
      startAngle = null
      startX = null
      if (committed) {
        // The two lifted fingers each fire their own touchend, which would
        // otherwise read as a double-tap and pop the modal right after
        // rotating. Hold the guard past the double-tap window (300ms).
        setTimeout(() => { rotationJustFired.current = false }, 400)
      }
      committed = false
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [onToggleHardMode])

  function handleDragEnd(_: unknown, info: { offset: { x: number }; velocity: { x: number } }) {
    const cardWidth = window.innerWidth * 0.82
    const committed = Math.abs(info.offset.x) > cardWidth * THRESHOLD || Math.abs(info.velocity.x) > 400

    if (committed && info.offset.x > 0) {
      haptics.swipeRight()
      animate(x, 600, { duration: 0.25 })
      setTimeout(onEasy, 220)
    } else if (committed && info.offset.x < 0) {
      haptics.swipeLeft()
      animate(x, -600, { duration: 0.25 })
      setTimeout(onHard, 220)
    } else {
      animate(x, 0, { type: 'spring', stiffness: 300, damping: 25 })
    }
  }

  return (
    <motion.div
      ref={cardRef}
      style={{ x, rotate, perspective: '1200px' }}
      drag={revealed ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      onDragEnd={revealed ? handleDragEnd : undefined}
      onTouchEnd={e => { if (rotationJustFired.current) return; doubleTap.onTouchEnd(e) }}
      onClick={e => { if (rotationJustFired.current) return; doubleTap.onClick(e); if (!revealed) onReveal() }}
      className={`relative w-full select-none ${revealed ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
      animate={isConquering ? { scale: [1, 1.04, 1], transition: { duration: 0.4 } } : {}}
    >
      {/* Conquered glow ring — sits outside the flipping element so it doesn't rotate */}
      {isConquering && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-[36px]"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: [0, 0.8, 0], scale: [0.95, 1.06, 1.12], transition: { duration: 0.5 } }}
          style={{ boxShadow: '0 0 0 3px rgba(180,160,255,0.9), 0 0 40px 8px rgba(180,160,255,0.5)' }}
        />
      )}

      {/* Inner wrapper that rotates on hard-mode toggle */}
      <motion.div style={{ rotateY: rotateYVal }}>
        <div className="relative rounded-[36px] shadow-[0_8px_48px_rgba(0,0,0,0.4),inset_0_0_0_1px_rgba(255,255,255,0.12)]">
          <GlassPane borderRadius={36} rotation={rotate} className="absolute inset-0 z-0 rounded-[36px] bg-[#F8FAFC]/[0.02]" />

          <div className="relative z-20 flex flex-col items-center gap-6 px-8 py-10">
            {/* Type badge + hard mode label */}
            <div className="flex items-center gap-2">
              <div className="relative flex items-center justify-center overflow-hidden rounded-[124px] border border-[#F8FAFC]/20 bg-[#F8FAFC]/10 px-3.5 py-[5px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]">
                <div
                  className="absolute inset-0 z-0 flex items-center justify-center opacity-70 mix-blend-screen"
                  dangerouslySetInnerHTML={{ __html: tagGradients[entry.type] ?? tagGradients['unknown'] }}
                />
                <span className="relative z-10 font-instrument text-[12px] font-medium capitalize text-[#F8FAFC]">
                  {entry.type}
                </span>
              </div>
              {displayHardMode && (
                <span className="font-instrument text-[11px] font-medium text-[#B4A0FF]/50">hard</span>
              )}
            </div>

            {/* Question word — pl in normal mode, en in hard mode */}
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="font-instrument text-[48px] font-bold leading-none tracking-tight text-[#F8FAFC]">
                {displayHardMode ? entry.en : entry.pl}
              </h1>
              {!displayHardMode && entry.type === 'noun' && entry.gender && (
                <span className="font-instrument text-[22px] italic text-[#e879f9]">{entry.gender}</span>
              )}
            </div>

            {/* Reveal area */}
            <AnimatePresence mode="wait">
              {!revealed ? (
                <motion.div
                  key="hint"
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  className="flex w-full flex-col items-center gap-3"
                >
                  <div className="h-[1px] w-full bg-[#F8FAFC]/10" />
                  <p className="font-instrument text-[14px] text-[#F8FAFC]/30">tap to reveal</p>
                </motion.div>
              ) : (
                <motion.div
                  key="translation"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex w-full flex-col items-center gap-3"
                >
                  <div className="h-[1px] w-full bg-[#F8FAFC]/10" />
                  <div className="flex w-full items-center justify-between gap-3">
                    {displayHardMode ? (
                      <div className="flex flex-col gap-1">
                        <p className="font-instrument text-[24px] font-medium text-[#B4A0FF]">{entry.pl}</p>
                        {entry.type === 'noun' && entry.gender && (
                          <span className="font-instrument text-[18px] italic text-[#e879f9]">{entry.gender}</span>
                        )}
                      </div>
                    ) : (
                      <p className="font-instrument text-[24px] font-medium text-[#B4A0FF]">{entry.en}</p>
                    )}
                    <GlassButton
                      onClick={e => { e.stopPropagation(); onReplay() }}
                      radius={16}
                      pane="bg-[#F8FAFC]/5"
                      className={`h-[32px] w-[32px] flex-shrink-0 border border-[#F8FAFC]/10 ${ttsState === 'error' ? 'text-red-400/70' : 'text-[#F8FAFC]/30 hover:text-[#F8FAFC]/70'}`}
                    >
                      <span className={`material-symbols-rounded text-[16px]${ttsState === 'playing' ? ' animate-pulse' : ''}`}>
                        {ttsState === 'loading' ? 'progress_activity' : ttsState === 'error' ? 'error' : 'volume_up'}
                      </span>
                    </GlassButton>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── All-caught-up state ───────────────────────────────────────────────────────

function AllCaughtUp({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 pt-16 text-center">
      <span className="material-symbols-rounded text-[56px] text-[#B4A0FF]/60">check_circle</span>
      <h2 className="font-instrument text-[26px] font-semibold text-[#F8FAFC]/80">All caught up</h2>
      <p className="font-instrument text-[16px] text-[#F8FAFC]/40">No cards due for review right now.</p>
      <GlassButton
        variant="primary"
        onClick={onReset}
        className="mt-2 px-6 py-3 font-instrument text-[15px]"
      >
        <span className="material-symbols-rounded text-[18px]">replay</span>
        Review again
      </GlassButton>
    </div>
  )
}

// ─── Action buttons ───────────────────────────────────────────────────────────

function ActionButtons({ onConquered, onLapse }: { onConquered: () => void; onLapse: () => void }) {
  return (
    <div className="flex w-full gap-3">
      <GlassButton
        variant="danger"
        onClick={onLapse}
        className="flex-1 py-4 font-instrument text-[15px]"
      >
        <span className="material-symbols-rounded text-[18px]">replay</span>
        Again
      </GlassButton>
      <GlassButton
        variant="primary"
        onClick={onConquered}
        className="flex-1 py-4 font-instrument text-[15px]"
      >
        <span className="material-symbols-rounded text-[18px]">military_tech</span>
        Conquered
      </GlassButton>
    </div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 100 : Math.round((done / total) * 100)
  return (
    <div className="flex w-full items-center gap-3">
      <div className="h-[4px] flex-1 overflow-hidden rounded-full bg-[#F8FAFC]/10">
        <motion.div
          className="h-full rounded-full bg-[#B4A0FF]/60"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
      <span className="font-instrument text-[13px] tabular-nums text-[#F8FAFC]/30">
        {done}/{total}
      </span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface Props {
  cards: VocabEntry[]
  onOpenModal?: (entry: VocabEntry) => void
}

export default function FlashcardPage({ cards, onOpenModal }: Props) {
  const [queue, setQueue] = useState<VocabEntry[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isConquering, setIsConquering] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [hardMode, setHardMode] = useState(false)
  const tts = useTTS()
  const x = useMotionValue(0)
  const leftOpacity  = useTransform(x, [-100, 0], [1, 0])
  const rightOpacity = useTransform(x, [0, 100],  [0, 1])
  // Keep the WebGL glass tracking the card while it's dragged/flung, so its
  // glass doesn't lag behind and render as a ghost card.
  useMotionValueEvent(x, 'change', pokeRenderer)

  useEffect(() => {
    const reviews = getAllReviews()
    const due = getDueCards(cards, reviews)
    setQueue(due)
    setTotalCount(due.length)
  }, [cards])

  // Derived: cards permanently removed from the queue (re-queued "Again" cards don't count)
  const doneCount = totalCount - queue.length

  const current = queue[0] ?? null

  // Pre-fetch both audio clips while the question side is visible so playback starts instantly on reveal
  useEffect(() => {
    if (current) tts.prefetch(current.pl, current.en)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id])

  const advance = useCallback(() => {
    tts.stop()
    animate(x, 0, { duration: 0 })
    setQueue(q => q.slice(1))
    setRevealed(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Move current card to position ~3 in queue so it comes back soon in this session
  const requeueCurrent = useCallback(() => {
    tts.stop()
    animate(x, 0, { duration: 0 })
    setQueue(q => {
      if (q.length <= 1) return q  // only card left — stays at front, re-revealed
      const [head, ...tail] = q
      const pos = Math.min(3, tail.length)
      return [...tail.slice(0, pos), head, ...tail.slice(pos)]
    })
    setRevealed(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleReveal() {
    if (!current) return
    setRevealed(true)
    tts.playSequence(current.pl, current.en)
  }

  function handleToggleHardMode() {
    setHardMode(h => !h)
    setRevealed(false)
  }

  function handleReset() {
    resetDueReviews()  // leaves conquered cards (interval >= 180) untouched
    const due = getDueCards(cards, getAllReviews())
    setQueue(due)
    setTotalCount(due.length)
    setRevealed(false)
  }

  function getOrInit(id: string) {
    return getReview(id) ?? initReview(id)
  }

  function handleEasy() {
    if (!current) return
    saveReview(current.id, applyEasy(getOrInit(current.id)))
    advance()
  }

  function handleHard() {
    if (!current) return
    saveReview(current.id, applyHard(getOrInit(current.id)))
    advance()
  }

  function handleConquered() {
    if (!current) return
    haptics.conquered()
    saveReview(current.id, applyConquered(getOrInit(current.id)))
    setIsConquering(true)
    setTimeout(() => {
      setIsConquering(false)
      advance()
    }, 520)
  }

  function handleLapse() {
    if (!current) return
    haptics.repeat()
    saveReview(current.id, applyLapse(getOrInit(current.id)))
    requeueCurrent()
  }

  return (
    <>
      {/* Swipe feedback glows — focal raised to ~40% so they align with the
          card (which sits above the viewport center) rather than mid-screen. */}
      <motion.div className="pointer-events-none fixed inset-0" style={{ opacity: leftOpacity, background: 'radial-gradient(ellipse at left 40%, rgba(222,0,4,0.85) 0%, transparent 65%)' }} />
      <motion.div className="pointer-events-none fixed inset-0" style={{ opacity: rightOpacity, background: 'radial-gradient(ellipse at right 40%, rgba(39,209,178,0.85) 0%, transparent 65%)' }} />
    <div className="animate-fade-in flex w-full flex-col gap-6 pt-6">
      {totalCount > 0 && (
        <ProgressBar done={doneCount} total={totalCount} />
      )}

      {current ? (
        <>
          <FlashCard
            key={current.id}
            entry={current}
            x={x}
            hardMode={hardMode}
            onToggleHardMode={handleToggleHardMode}
            onEasy={handleEasy}
            onHard={handleHard}
            onConquered={handleConquered}
            onLapse={handleLapse}
            isConquering={isConquering}
            revealed={revealed}
            onReveal={handleReveal}
            ttsState={tts.state}
            onReplay={() => tts.playSequence(current.pl, current.en)}
            onOpenModal={onOpenModal}
          />
          <AnimatePresence>
            {revealed && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.05 }}
                className="flex w-full flex-col gap-3"
              >
                <ActionButtons onConquered={handleConquered} onLapse={handleLapse} />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <AllCaughtUp onReset={handleReset} />
      )}
    </div>
    </>
  )
}
