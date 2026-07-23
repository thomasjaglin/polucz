import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, useMotionValueEvent, animate } from 'framer-motion'
import type { VocabEntry } from '../data/types'
import { getReview, getAllReviews, saveReview, initReview, resetAllReviews } from '../lib/reviewStorage'
import { applyEasy, applyHard, applyLapse } from '../lib/scheduler'
import { useTTS, type AudioState } from '../lib/useTTS'
import { tagGradients } from '../data/gradients'
import { pokeRenderer } from '../webgl/glassStore'
import GlassPane from './GlassPane'
import GlassButton from './GlassButton'
import { useDoubleTap } from '../hooks/useDoubleTap'

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'playing' | 'waiting' | 'done'

interface Props {
  cards: VocabEntry[]
  onOpenModal?: (entry: VocabEntry) => void
}

// ─── Animated waveform ────────────────────────────────────────────────────────

function Waveform({ active }: { active: boolean }) {
  const heights = [28, 48, 36, 56, 32, 44, 24]
  return (
    <div className="flex items-center justify-center gap-[5px]" style={{ height: 64 }}>
      {heights.map((h, i) => (
        <motion.div
          key={i}
          className="w-[4px] rounded-full bg-[#B4A0FF]"
          animate={active
            ? { height: [h * 0.4, h, h * 0.4], opacity: [0.4, 0.9, 0.4] }
            : { height: h * 0.25, opacity: 0.2 }}
          transition={active
            ? { duration: 0.9 + i * 0.08, repeat: Infinity, ease: 'easeInOut', delay: i * 0.11 }
            : { duration: 0.3 }}
          style={{ height: h * 0.25 }}
        />
      ))}
    </div>
  )
}

// ─── Audio Playback Page ──────────────────────────────────────────────────────

export default function AudioPlaybackPage({ cards, onOpenModal }: Props) {
  // Index-based queue (rather than popping) so swiping can go back to
  // previous cards
  const [queue, setQueue]       = useState<VocabEntry[]>([])
  const [idx, setIdx]           = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [phase, setPhase]       = useState<Phase>('idle')
  // Start screen: nothing plays until the user picks an order and taps play.
  const [started, setStarted]   = useState(false)
  const [order, setOrder]       = useState<'list' | 'new-first'>('list')
  const tts = useTTS()

  // Enriched cards available for review — drives the start / empty screens.
  const availableCount = cards.filter(c => c.enriched).length

  // Swipe motion for the card
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-300, 0, 300], [-14, 0, 14])
  // Keep the WebGL glass tracking the card during swipe so it doesn't ghost.
  useMotionValueEvent(x, 'change', pokeRenderer)

  // Refs that need to be readable inside effects without triggering re-renders
  const prevTtsStateRef = useRef<AudioState>('idle')
  // true when the user manually rated/skipped a card — suppresses the
  // auto-easy-advance when the interrupted playback settles to idle
  const userRatedRef    = useRef(false)

  // ─── Queue building / start ────────────────────────────────────────────────
  // Order: 'list' plays the enriched cards in list order (newest first, as on
  // the folder page); 'new-first' floats never-reviewed cards to the front.
  function buildQueue(o: 'list' | 'new-first'): VocabEntry[] {
    const due = [...cards].reverse().filter(c => c.enriched)
    if (o === 'new-first') {
      const reviews = getAllReviews()
      const isNew = (c: VocabEntry) => { const r = reviews[c.id]; return !r || r.reviewCount === 0 }
      return [...due.filter(isNew), ...due.filter(c => !isNew(c))]
    }
    return due
  }

  function beginPlayback(o: 'list' | 'new-first') {
    setOrder(o)
    const due = buildQueue(o)
    setQueue(due)
    setTotalCount(due.length)
    setIdx(0)
    tts.stop()
    setPhase(due.length > 0 ? 'playing' : 'idle')
    setStarted(true)
  }

  // Replay from the done screen keeps whichever order was chosen.
  const replay = () => beginPlayback(order)

  const current = queue[idx] ?? null
  const doubleTap = useDoubleTap(useCallback(() => { if (current) onOpenModal?.(current) }, [current, onOpenModal]))

  // ─── Start TTS when phase becomes 'playing' or the current card changes ────
  useEffect(() => {
    if (phase === 'playing' && current) {
      tts.playSequence(current.pl, current.en)
    }
  }, [phase, current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Prefetch next card while current is playing
  useEffect(() => {
    if (queue[idx + 1]) tts.prefetch(queue[idx + 1].pl, queue[idx + 1].en)
  }, [queue[idx + 1]?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Detect natural sequence completion (playing → idle) ──────────────────
  useEffect(() => {
    const prev = prevTtsStateRef.current
    prevTtsStateRef.current = tts.state

    if (prev === 'playing' && tts.state === 'idle' && phase === 'playing') {
      const wasUserRated = userRatedRef.current
      userRatedRef.current = false
      if (wasUserRated) return // user already rated/skipped — idx change plays next card

      // Natural completion: advance as Easy, then wait 2 s before next card
      if (current) {
        const state = getReview(current.id) ?? initReview(current.id)
        saveReview(current.id, applyEasy(state))
      }
      setIdx(i => i + 1)
      setPhase('waiting')
    }
  }, [tts.state, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 2 s between-card gap ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'waiting') return
    const timer = setTimeout(() => setPhase('playing'), 2000)
    return () => clearTimeout(timer)
  }, [phase])

  // ─── All-done detection ───────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'playing' && totalCount > 0 && idx >= queue.length) setPhase('done')
  }, [phase, idx, queue.length, totalCount])

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function handleStart() {
    if (!current) return
    setPhase('playing')
  }

  function handlePause() {
    setPhase('idle')
    tts.stop()
  }

  function handleResume() {
    if (!current) return
    setPhase('playing')
  }

  function rateAndAdvance(outcome: 'hard' | 'lapse') {
    if (!current) return
    // Only suppress the auto-advance if TTS is currently playing
    if (tts.state === 'playing') userRatedRef.current = true
    tts.stop()
    const state = getReview(current.id) ?? initReview(current.id)
    saveReview(current.id, outcome === 'hard' ? applyHard(state) : applyLapse(state))
    setIdx(i => i + 1)
    // phase stays 'playing' → effect fires on current?.id change → plays next card
  }

  // Manual navigation (swipe) — no rating, just moves through the queue
  function skipTo(newIdx: number) {
    if (tts.state === 'playing') userRatedRef.current = true
    tts.stop()
    setIdx(newIdx)
    setPhase('playing')
  }

  function handleDragEnd(_: unknown, info: { offset: { x: number }; velocity: { x: number } }) {
    const committed = Math.abs(info.offset.x) > window.innerWidth * 0.25 || Math.abs(info.velocity.x) > 400
    if (committed && info.offset.x < 0 && idx < queue.length) {
      // swipe left → next card
      animate(x, -600, { duration: 0.22 })
      setTimeout(() => { x.set(0); skipTo(idx + 1) }, 200)
    } else if (committed && info.offset.x > 0 && idx > 0) {
      // swipe right → previous card
      animate(x, 600, { duration: 0.22 })
      setTimeout(() => { x.set(0); skipTo(idx - 1) }, 200)
    } else {
      animate(x, 0, { type: 'spring', stiffness: 300, damping: 25 })
    }
  }

  // ─── Derived UI values ────────────────────────────────────────────────────

  const doneCount     = Math.min(idx, totalCount)
  const progress      = totalCount > 0 ? doneCount / totalCount : 0
  const typeGradient  = current ? (tagGradients[current.type] ?? tagGradients['unknown']) : null
  const isActive      = phase === 'playing' || phase === 'waiting'
  const showControls  = phase !== 'done'

  function statusText(): string {
    if (phase === 'idle')    return 'Ready to start'
    if (phase === 'waiting') return 'Next card…'
    if (tts.state === 'loading') return 'Loading…'
    if (tts.state === 'error')   return 'Audio error'
    return 'Listening'
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col items-center gap-6 pt-2">

      {/* Progress row */}
      {totalCount > 0 && (
        <div className="flex w-full flex-col gap-2">
          <div className="flex justify-between">
            <span className="font-instrument text-[13px] text-[#F8FAFC]/40">
              {phase === 'done' ? 'Completed' : `${doneCount} / ${totalCount}`}
            </span>
            {phase !== 'idle' && phase !== 'done' && (
              <span className="font-instrument text-[13px] text-[#B4A0FF]/60">{statusText()}</span>
            )}
          </div>
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/[0.08]">
            <motion.div
              className="h-full rounded-full bg-[#B4A0FF]/60"
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </div>
      )}

      {/* ── Empty / Start / Done / Card ───────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {availableCount === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-1 flex-col items-center justify-center gap-4 text-center"
          >
            <span className="material-symbols-rounded text-[56px] text-[#F8FAFC]/30">spatial_audio</span>
            <h2 className="font-instrument text-[22px] font-semibold text-[#F8FAFC]/60">No cards yet</h2>
            <p className="font-instrument text-[15px] text-[#F8FAFC]/30 px-4">
              Add vocabulary words to start audio review.
            </p>
          </motion.div>
        ) : !started ? (
          <motion.div
            key="start"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="flex flex-1 flex-col items-center justify-center gap-5 text-center"
          >
            <span className="material-symbols-rounded text-[56px] text-[#B4A0FF]/60">spatial_audio</span>
            <div className="flex flex-col gap-1">
              <h2 className="font-instrument text-[24px] font-semibold text-[#F8FAFC]/80">Audio review</h2>
              <p className="font-instrument text-[15px] text-[#F8FAFC]/40">{availableCount} cards ready</p>
            </div>
            <GlassButton
              onClick={() => beginPlayback('list')}
              radius={28}
              pane="bg-[#B4A0FF]/15"
              className="mt-1 border border-[#B4A0FF]/25 px-7 py-3.5 font-instrument text-[16px] font-medium text-[#B4A0FF]"
            >
              <span className="material-symbols-rounded text-[20px]">play_arrow</span>
              Play through list
            </GlassButton>
            <GlassButton
              onClick={() => beginPlayback('new-first')}
              radius={24}
              pane="bg-white/5"
              className="border border-white/10 px-5 py-2.5 font-instrument text-[14px] text-[#F8FAFC]/60"
            >
              <span className="material-symbols-rounded text-[16px]">fiber_new</span>
              Play with new words first
            </GlassButton>
          </motion.div>
        ) : phase === 'done' ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="flex flex-1 flex-col items-center justify-center gap-4 text-center"
          >
            <span className="material-symbols-rounded text-[56px] text-[#B4A0FF]/60">check_circle</span>
            <h2 className="font-instrument text-[26px] font-semibold text-[#F8FAFC]/80">All caught up</h2>
            <p className="font-instrument text-[16px] text-[#F8FAFC]/40">
              You've listened to all {totalCount} cards.
            </p>
            <GlassButton
              onClick={replay}
              radius={28}
              pane="bg-[#B4A0FF]/10"
              className="mt-2 border border-[#B4A0FF]/20 px-6 py-3 font-instrument text-[15px] font-medium text-[#B4A0FF]"
            >
              <span className="material-symbols-rounded text-[18px]">replay</span>
              Listen again
            </GlassButton>
            <GlassButton
              onClick={() => { resetAllReviews(); replay() }}
              radius={28}
              pane="bg-white/5"
              className="border border-white/10 px-5 py-2.5 font-instrument text-[14px] text-[#F8FAFC]/50"
            >
              <span className="material-symbols-rounded text-[16px]">refresh</span>
              Reset all progress
            </GlassButton>
          </motion.div>
        ) : (
          <motion.div
            key="card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex w-full flex-1 flex-col items-center gap-6"
          >
            {/* Card — swipe left for next, right for previous */}
            <motion.div
              style={{ x, rotate }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.8}
              onDragEnd={handleDragEnd}
              onTouchEnd={doubleTap.onTouchEnd}
              onClick={doubleTap.onClick}
              className="relative w-full cursor-grab select-none rounded-[36px] shadow-[0_8px_48px_rgba(0,0,0,0.4),inset_0_0_0_1px_rgba(255,255,255,0.12)] active:cursor-grabbing"
            >
              <GlassPane borderRadius={36} rotation={rotate} className="absolute inset-0 z-0 rounded-[36px] bg-white/[0.02]" />
              <div className="relative z-10 flex flex-col items-center gap-5 px-8 py-10">

                {/* Type badge */}
                {current && (
                  <div className="relative flex items-center justify-center overflow-hidden rounded-[124px] border border-[#F8FAFC]/20 bg-[#F8FAFC]/10 px-[14px] py-[5px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]">
                    {typeGradient && (
                      <div
                        className="absolute inset-0 z-0 opacity-70 mix-blend-screen"
                        dangerouslySetInnerHTML={{ __html: typeGradient }}
                      />
                    )}
                    <span className="relative z-10 font-instrument text-[12px] font-medium capitalize text-[#F8FAFC]">
                      {current.type}
                    </span>
                  </div>
                )}

                {/* Polish word */}
                <AnimatePresence mode="wait">
                  {current && (
                    <motion.div
                      key={current.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col items-center gap-2 text-center"
                    >
                      <h1 className="font-instrument text-[48px] font-bold leading-none tracking-tight text-[#F8FAFC]">
                        {current.pl}
                      </h1>
                      {current.type === 'noun' && current.gender && (
                        <span className="font-instrument text-[20px] italic text-[#e879f9]">{current.gender}</span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Divider */}
                <div className="h-[1px] w-full bg-white/10" />

                {/* EN translation */}
                <AnimatePresence mode="wait">
                  {current && (
                    <motion.p
                      key={current.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: isActive ? 0.5 : 0.25 }}
                      transition={{ duration: 0.3 }}
                      className="font-instrument text-[22px] font-medium text-[#B4A0FF]"
                    >
                      {current.en}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Waveform */}
            <Waveform active={isActive && tts.state === 'playing'} />

            {/* Controls */}
            {showControls && (
              <div className="flex w-full items-center justify-between gap-3 pb-4">
                {/* Hard */}
                <GlassButton
                  onClick={() => rateAndAdvance('hard')}
                  disabled={phase !== 'playing'}
                  radius={24}
                  pane="bg-white/5"
                  contentClassName="flex w-full items-center justify-center gap-1.5"
                  className="flex-1 border border-white/10 py-3 font-instrument text-[14px] font-medium text-[#F8FAFC]/60 disabled:opacity-30"
                >
                  <span className="material-symbols-rounded text-[16px]">thumb_down</span>
                  Hard
                </GlassButton>

                {/* Play / Pause */}
                <button
                  onClick={phase === 'idle' ? handleStart : (isActive ? handlePause : handleResume)}
                  disabled={!current}
                  className="relative flex h-[60px] w-[60px] flex-shrink-0 items-center justify-center rounded-full border border-[#B4A0FF]/30 shadow-[0_0_24px_rgba(180,160,255,0.25)] transition-all hover:scale-105 active:scale-[0.94] disabled:pointer-events-none disabled:opacity-30"
                >
                  <GlassPane borderRadius={30} className="absolute inset-0 z-0 rounded-full bg-[#B4A0FF]/15" />
                  <span className="material-symbols-rounded relative z-10 text-[28px] text-[#B4A0FF]">
                    {isActive ? 'pause' : 'play_arrow'}
                  </span>
                </button>

                {/* Again */}
                <GlassButton
                  onClick={() => rateAndAdvance('lapse')}
                  disabled={phase !== 'playing'}
                  radius={24}
                  pane="bg-white/5"
                  contentClassName="flex w-full items-center justify-center gap-1.5"
                  className="flex-1 border border-white/10 py-3 font-instrument text-[14px] font-medium text-[#F8FAFC]/60 disabled:opacity-30"
                >
                  Again
                  <span className="material-symbols-rounded text-[16px]">replay</span>
                </GlassButton>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
