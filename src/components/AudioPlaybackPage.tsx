import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { VocabEntry } from '../data/types'
import { getAllReviews, resetAllReviews } from '../lib/reviewStorage'
import { useTTS, type AudioState } from '../lib/useTTS'
import { tagGradients } from '../data/gradients'
import { getGlassMode } from '../lib/glassMode'
import { setAudioCard } from '../webgl/glassStore'
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

// Same meta line as the vocab list card: gender for nouns, aspect for verbs.
function cardMeta(entry: VocabEntry): string | null {
  if (entry.type === 'noun') return entry.gender || null
  if (entry.type === 'verb') return entry.left || null
  return null
}

// How many cards fan out on each side of the current one.
const AROUND = 5

// Position of a peek card at signed distance `d` from the current card
// (d > 0 = upcoming, below; d < 0 = already played, above). Together the two
// wings trace an arc bulging to the right, with the current card at its vertex:
// farther cards sit lower/higher, further left, more rotated and more faded.
function arcSlot(d: number) {
  const ad = Math.abs(d)
  const y = d * 50
  return {
    x: -(ad ** 1.15) * 22,
    y,
    rotate: d * 5.6,
    scale: 1 - Math.min(ad * 0.045, 0.32),
    opacity: Math.max(0.05, 0.5 - ad * 0.1),
    // Gentle depth-of-field — nearer cards stay fairly sharp, deeper ones soften.
    blur: Math.min(ad * 0.8, 3),
  }
}

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
  // Repeat toggle: when on, a card replays itself on natural completion
  // instead of advancing to the next one.
  const [repeatOne, setRepeatOne] = useState(false)
  const tts = useTTS()

  // Enriched cards available for review — drives the start / empty screens.
  const availableCount = cards.filter(c => c.enriched).length

  // Refs that need to be readable inside effects without triggering re-renders
  const prevTtsStateRef = useRef<AudioState>('idle')
  // true when the user manually rated/skipped a card — suppresses the
  // auto-easy-advance when the interrupted playback settles to idle
  const userRatedRef    = useRef(false)
  // The front card element — its rect drives the per-word colour glow baked into
  // the WebGL background so the card's transparent glass refracts it.
  const cardRef = useRef<HTMLDivElement>(null)

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

  // Feed the front card's rect + word type to the WebGL background so it bakes a
  // per-word colour glow there; the card's transparent glass then refracts it.
  useEffect(() => {
    if (getGlassMode() !== 'webgl') return
    if (!started || phase === 'done' || !current) { setAudioCard(null); return }
    const type = current.type
    function measure() {
      const el = cardRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) return
      setAudioCard({ cx: r.left + r.width / 2, cy: r.top + r.height / 2, rx: r.width / 2, ry: r.height / 2, type })
    }
    const raf = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', measure) }
  }, [current?.id, started, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clear the glow when the page unmounts.
  useEffect(() => () => setAudioCard(null), [])

  // ─── Start TTS when phase becomes 'playing' or the current card changes ────
  useEffect(() => {
    if (phase === 'playing' && current) {
      tts.playSequence(current.pl, current.en)
    }
  }, [phase, current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-load the upcoming few cards' audio (cache is deduped) so advancing or
  // skipping into them has no loading gap.
  useEffect(() => {
    for (let k = 1; k <= 3; k++) {
      const c = queue[idx + k]
      if (c) tts.prefetch(c.pl, c.en)
    }
  }, [idx, queue]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Advance when a card finishes OR errors out ───────────────────────────
  // Move on for a clean finish (playing → idle) AND for a failure (playing →
  // error): a word whose audio couldn't be produced must not freeze the whole
  // player — it's skipped so hands-off listening keeps going.
  useEffect(() => {
    const prev = prevTtsStateRef.current
    prevTtsStateRef.current = tts.state

    if (prev === 'playing' && (tts.state === 'idle' || tts.state === 'error') && phase === 'playing') {
      const wasUserSkipped = userRatedRef.current
      userRatedRef.current = false
      if (wasUserSkipped) return // user already skipped — idx change plays next card

      // Pure player: no SRS rating. Repeat-one replays the same card (only on a
      // clean finish); otherwise advance. A 2 s gap ('waiting') precedes next.
      if (!(repeatOne && tts.state === 'idle')) setIdx(i => i + 1)
      setPhase('waiting')
    }
  }, [tts.state, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Watchdog: never get stuck on a word ──────────────────────────────────
  // If a word neither finishes nor errors within a generous window (e.g. a clip
  // whose 'ended' event never fires, or a stalled fetch), force it forward so
  // the player can't freeze on one card.
  useEffect(() => {
    if (phase !== 'playing' || !current) return
    const timer = setTimeout(() => {
      tts.stop()
      setIdx(i => i + 1)
      setPhase('waiting')
    }, 30000)
    return () => clearTimeout(timer)
  }, [phase, current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Manual navigation (swipe / skip button) — a neutral move through the
  // queue with no effect on SRS scheduling.
  function skipTo(newIdx: number) {
    if (tts.state === 'playing') userRatedRef.current = true
    tts.stop()
    setIdx(newIdx)
    setPhase('playing')
  }

  // Skip-next control: advance one card (neutral). Skipping past the last
  // card lets the all-done effect surface the finished screen.
  function handleSkipNext() {
    if (idx < queue.length) skipTo(idx + 1)
  }

  // ─── Derived UI values ────────────────────────────────────────────────────

  const doneCount     = Math.min(idx, totalCount)
  const progress      = totalCount > 0 ? doneCount / totalCount : 0
  const typeGradient  = current ? (tagGradients[current.type] ?? tagGradients['unknown']) : null
  const isActive      = phase === 'playing' || phase === 'waiting'
  const showControls  = phase !== 'done'
  // Cards fanned into an arc around the current one: upcoming below (d > 0),
  // already-played above (d < 0). Nearer cards paint last (on top).
  const peekCards = [
    ...queue.slice(idx + 1, idx + 1 + AROUND).map((entry, i) => ({ entry, d: i + 1 })),
    ...Array.from({ length: AROUND }, (_, k) => ({ entry: queue[idx - 1 - k], d: -(k + 1) }))
      .filter((p): p is { entry: VocabEntry; d: number } => Boolean(p.entry)),
  ].sort((a, b) => Math.abs(b.d) - Math.abs(a.d))

  function statusText(): string {
    if (phase === 'idle')    return 'Ready to start'
    if (phase === 'waiting') return repeatOne ? 'Repeating…' : 'Next card…'
    if (tts.state === 'loading') return 'Loading…'
    if (tts.state === 'error')   return 'Skipping…'
    return 'Playing'
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
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-[#F8FAFC]/10">
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
              variant="primary"
              onClick={() => beginPlayback('list')}
              className="mt-1 px-7 py-3.5 font-instrument text-[16px]"
            >
              <span className="material-symbols-rounded text-[20px]">play_arrow</span>
              Play through list
            </GlassButton>
            <GlassButton
              variant="secondary"
              onClick={() => beginPlayback('new-first')}
              className="px-5 py-2.5 font-instrument text-[14px]"
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
              variant="primary"
              onClick={replay}
              className="mt-2 px-6 py-3 font-instrument text-[15px]"
            >
              <span className="material-symbols-rounded text-[18px]">replay</span>
              Listen again
            </GlassButton>
            <GlassButton
              variant="secondary"
              onClick={() => { resetAllReviews(); replay() }}
              className="px-5 py-2.5 font-instrument text-[14px]"
            >
              <span className="material-symbols-rounded text-[16px]">refresh</span>
              Reset all progress
            </GlassButton>
          </motion.div>
        ) : (
          <motion.div
            key="card"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative flex w-full flex-1 flex-col items-center justify-center gap-8"
          >
            {/* Card + peek stack: cards fan into an arc around the current one —
                upcoming curving down-left, already-played curving up-left — each
                showing its word so you can preview what's coming and glance back
                at what played. They spring one slot along the arc as playback
                advances. */}
            <div className="relative w-full">
              <AnimatePresence>
                {peekCards.map(({ entry, d }) => {
                  const s = arcSlot(d)
                  return (
                    <motion.div
                      key={entry.id}
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-[36px] border border-[#F8FAFC]/10 bg-[#F8FAFC]/5 shadow-[0_8px_32px_rgba(0,0,0,0.25)]"
                      initial={d < 0
                        ? { opacity: 0, x: 0, y: 0, rotate: 0, scale: 1, filter: 'blur(0px)' }
                        : { opacity: 0, x: s.x, y: s.y + 24, rotate: s.rotate, scale: s.scale, filter: `blur(${s.blur}px)` }}
                      animate={{ opacity: s.opacity, x: s.x, y: s.y, rotate: s.rotate, scale: s.scale, filter: `blur(${s.blur}px)` }}
                      exit={{ opacity: 0, transition: { duration: 0.15 } }}
                      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                    >
                      <div className="flex items-start justify-between gap-3 p-5">
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="truncate font-instrument text-[24px] font-semibold leading-tight tracking-wide text-[#F8FAFC]">
                            {entry.pl}
                          </span>
                          <span className="truncate font-instrument text-[18px] font-medium leading-snug text-[#B4A0FF]/80">
                            {entry.en}
                          </span>
                        </div>
                        <span className="mt-1 flex-shrink-0 rounded-[124px] border border-[#F8FAFC]/20 bg-[#F8FAFC]/10 px-3 py-1 font-instrument text-[10px] capitalize text-[#F8FAFC]">
                          {entry.type}
                        </span>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            {/* Transparent glass, exactly like the vocab card: the per-word
                colour glow now lives in the WebGL background (see the cardRef
                effect + backgroundData audio blob), so the card's own GlassPane
                refracts it with the renderer's real rim light — no opaque DOM
                gradient in front of the canvas to hide the effect. */}
            <motion.div
              ref={cardRef}
              onTouchEnd={doubleTap.onTouchEnd}
              onClick={doubleTap.onClick}
              className="relative w-full select-none rounded-[36px] shadow-[0_8px_32px_rgba(0,0,0,0.25),inset_0_0_0_1px_rgba(255,255,255,0.12)]"
            >
              <GlassPane borderRadius={36} className="absolute inset-0 z-0 rounded-[36px] bg-[#F8FAFC]/[0.02]" />
              {/* Same compact layout as the vocab list card (VocabCard) */}
              <div className="relative z-10 p-5">
                <AnimatePresence mode="wait">
                  {current && (
                    <motion.div
                      key={current.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-start justify-between gap-3"
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <span lang="pl" className="hyphens-auto break-words font-instrument text-[24px] font-semibold leading-tight tracking-wide text-[#F8FAFC]">
                          {current.pl}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-instrument text-[18px] font-medium leading-snug text-[#B4A0FF]/80">
                            {current.en}
                          </span>
                          {cardMeta(current) && (
                            <>
                              <span className="text-[#F8FAFC]/20">·</span>
                              <span className="font-instrument text-[13px] italic text-[#F8FAFC]/40">{cardMeta(current)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <GlassPane borderRadius={62} className="relative mt-1 flex flex-shrink-0 items-center justify-center rounded-[124px] border border-[#F8FAFC]/20 bg-[#F8FAFC]/10 px-3 py-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]">
                        {typeGradient && (
                          <div
                            className="absolute inset-0 z-0 flex items-center justify-center opacity-70 mix-blend-screen"
                            dangerouslySetInnerHTML={{ __html: typeGradient }}
                          />
                        )}
                        <span className="relative z-10 font-instrument text-[10px] font-normal capitalize text-[#F8FAFC]">
                          {current.type}
                        </span>
                      </GlassPane>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
            </div>

            {/* Waveform */}
            <Waveform active={isActive && tts.state === 'playing'} />

            {/* Controls — vertical column pinned to the right (thumb zone):
                repeat-one (top), Play/Pause (large, middle), skip-next (bottom). */}
            {showControls && (
              <div className="absolute bottom-2 right-0 z-10 flex flex-col items-center gap-3.5">
                {/* Repeat current card — toggle */}
                <button
                  onClick={() => setRepeatOne(r => !r)}
                  aria-pressed={repeatOne}
                  className={`relative flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-full border transition-all hover:scale-105 active:scale-95 ${repeatOne ? 'border-[#B4A0FF]/40' : 'border-[#F8FAFC]/10'}`}
                >
                  <GlassPane borderRadius={24} className={`absolute inset-0 z-0 rounded-full ${repeatOne ? 'bg-[#B4A0FF]/15' : 'bg-[#F8FAFC]/5'}`} />
                  <span className={`material-symbols-rounded relative z-10 text-[20px] ${repeatOne ? 'text-[#B4A0FF]' : 'text-[#F8FAFC]/50'}`}>
                    repeat_one
                  </span>
                </button>

                {/* Play / Pause — primary, large */}
                <button
                  onClick={phase === 'idle' ? handleStart : (isActive ? handlePause : handleResume)}
                  disabled={!current}
                  className="relative flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center rounded-full border border-[#B4A0FF]/30 shadow-[0_0_24px_rgba(180,160,255,0.25)] transition-all hover:scale-105 active:scale-[0.94] disabled:pointer-events-none disabled:opacity-30"
                >
                  <GlassPane borderRadius={36} className="absolute inset-0 z-0 rounded-full bg-[#B4A0FF]/15" />
                  <span className="material-symbols-rounded relative z-10 text-[34px] text-[#B4A0FF]">
                    {isActive ? 'pause' : 'play_arrow'}
                  </span>
                </button>

                {/* Skip to next card — neutral advance */}
                <button
                  onClick={handleSkipNext}
                  disabled={!current || idx >= queue.length}
                  className="relative flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-full border border-[#F8FAFC]/10 transition-all hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-30"
                >
                  <GlassPane borderRadius={24} className="absolute inset-0 z-0 rounded-full bg-[#F8FAFC]/5" />
                  <span className="material-symbols-rounded relative z-10 text-[22px] text-[#F8FAFC]/60">skip_next</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
