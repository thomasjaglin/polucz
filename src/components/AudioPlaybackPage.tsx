import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { VocabEntry } from '../data/types'
import { getAllReviews, getReview, saveReview, initReview, resetAllReviews } from '../lib/reviewStorage'
import { getDueCards, applyEasy, applyHard, applyLapse } from '../lib/scheduler'
import { useTTS, type AudioState } from '../lib/useTTS'
import { tagGradients } from '../data/gradients'
import GlassPane from './GlassPane'

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'playing' | 'waiting' | 'done'

interface Props {
  cards: VocabEntry[]
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

export default function AudioPlaybackPage({ cards }: Props) {
  const [queue, setQueue]       = useState<VocabEntry[]>([])
  const [doneCount, setDoneCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [phase, setPhase]       = useState<Phase>('idle')
  const tts = useTTS()

  // Refs that need to be readable inside effects without triggering re-renders
  const prevTtsStateRef = useRef<AudioState>('idle')
  // true when the user manually rated a card — suppresses the auto-easy-advance
  const userRatedRef    = useRef(false)

  // ─── Initialise / reset queue ──────────────────────────────────────────────
  function loadQueue() {
    const due = getDueCards(cards, getAllReviews())
    setQueue(due)
    setTotalCount(due.length)
    setDoneCount(0)
    setPhase('idle')
    tts.stop()
  }

  useEffect(() => { loadQueue() }, [cards]) // eslint-disable-line react-hooks/exhaustive-deps

  const current = queue[0] ?? null

  // ─── Start TTS when phase becomes 'playing' or the current card changes ────
  useEffect(() => {
    if (phase === 'playing' && current) {
      tts.playSequence(current.pl, current.en)
    }
  }, [phase, current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Prefetch next card while current is playing
  useEffect(() => {
    if (queue[1]) tts.prefetch(queue[1].pl, queue[1].en)
  }, [queue[1]?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Detect natural sequence completion (playing → idle) ──────────────────
  useEffect(() => {
    const prev = prevTtsStateRef.current
    prevTtsStateRef.current = tts.state

    if (prev === 'playing' && tts.state === 'idle' && phase === 'playing') {
      const wasUserRated = userRatedRef.current
      userRatedRef.current = false
      if (wasUserRated) return // user already rated — queue effect plays next card

      // Natural completion: advance as Easy, then wait 2 s before next card
      setQueue(q => {
        if (!q[0]) return q
        const state = getReview(q[0].id) ?? initReview(q[0].id)
        saveReview(q[0].id, applyEasy(state))
        return q.slice(1)
      })
      setDoneCount(n => n + 1)
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
    if (phase === 'playing' && queue.length === 0) setPhase('done')
  }, [phase, queue.length])

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
    setDoneCount(n => n + 1)
    setQueue(q => q.slice(1))
    // phase stays 'playing' → effect fires on current?.id change → plays next card
  }

  // ─── Derived UI values ────────────────────────────────────────────────────

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

      {/* ── Done state ────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {phase === 'done' ? (
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
            <button
              onClick={loadQueue}
              className="mt-2 flex items-center gap-2 rounded-[28px] border border-[#B4A0FF]/20 bg-[#B4A0FF]/10 px-6 py-3 font-instrument text-[15px] font-medium text-[#B4A0FF] transition-all hover:bg-[#B4A0FF]/20 active:scale-[0.97]"
            >
              <span className="material-symbols-rounded text-[18px]">replay</span>
              Listen again
            </button>
            <button
              onClick={() => { resetAllReviews(); loadQueue() }}
              className="flex items-center gap-2 rounded-[28px] border border-white/10 bg-white/5 px-5 py-2.5 font-instrument text-[14px] text-[#F8FAFC]/50 transition-all hover:bg-white/10 active:scale-[0.97]"
            >
              <span className="material-symbols-rounded text-[16px]">refresh</span>
              Reset all progress
            </button>
          </motion.div>
        ) : totalCount === 0 ? (
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
        ) : (
          <motion.div
            key="card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex w-full flex-1 flex-col items-center gap-6"
          >
            {/* Card */}
            <div className="relative w-full rounded-[36px] shadow-[0_8px_48px_rgba(0,0,0,0.4),inset_0_0_0_1px_rgba(255,255,255,0.12)]">
              <GlassPane borderRadius={36} className="absolute inset-0 z-0 rounded-[36px] bg-white/[0.02]" />
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
            </div>

            {/* Waveform */}
            <Waveform active={isActive && tts.state === 'playing'} />

            {/* Controls */}
            {showControls && (
              <div className="flex w-full items-center justify-between gap-3 pb-4">
                {/* Hard */}
                <button
                  onClick={() => rateAndAdvance('hard')}
                  disabled={phase !== 'playing'}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-[24px] border border-white/10 bg-white/5 py-3 font-instrument text-[14px] font-medium text-[#F8FAFC]/60 transition-all hover:bg-white/10 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-30"
                >
                  <span className="material-symbols-rounded text-[16px]">thumb_down</span>
                  Hard
                </button>

                {/* Play / Pause */}
                <button
                  onClick={phase === 'idle' ? handleStart : (isActive ? handlePause : handleResume)}
                  disabled={!current}
                  className="flex h-[60px] w-[60px] flex-shrink-0 items-center justify-center rounded-full border border-[#B4A0FF]/30 bg-[#B4A0FF]/20 shadow-[0_0_24px_rgba(180,160,255,0.25)] transition-all hover:bg-[#B4A0FF]/30 active:scale-[0.94] disabled:pointer-events-none disabled:opacity-30"
                >
                  <span className="material-symbols-rounded text-[28px] text-[#B4A0FF]">
                    {isActive ? 'pause' : 'play_arrow'}
                  </span>
                </button>

                {/* Again */}
                <button
                  onClick={() => rateAndAdvance('lapse')}
                  disabled={phase !== 'playing'}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-[24px] border border-white/10 bg-white/5 py-3 font-instrument text-[14px] font-medium text-[#F8FAFC]/60 transition-all hover:bg-white/10 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-30"
                >
                  Again
                  <span className="material-symbols-rounded text-[16px]">replay</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
