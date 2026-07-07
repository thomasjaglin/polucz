import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion'
import { tagGradients } from '../data/gradients'
import type { VocabEntry } from '../data/types'
import { getAllReviews, getReview, saveReview, initReview, resetDueReviews } from '../lib/reviewStorage'
import { getDueCards, applyEasy, applyHard, applyConquered, applyLapse } from '../lib/scheduler'
import { useTTS, type AudioState } from '../lib/useTTS'
import GlassPane from './GlassPane'
import GlassButton from './GlassButton'
import { useDoubleTap } from '../hooks/useDoubleTap'

// ─── Drag threshold (fraction of card width) ──────────────────────────────────

const THRESHOLD = 0.30

// ─── Flashcard UI ─────────────────────────────────────────────────────────────

interface CardProps {
  entry: VocabEntry
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

function FlashCard({ entry, onEasy, onHard, onConquered, onLapse, isConquering, revealed, onReveal, ttsState, onReplay, onOpenModal }: CardProps) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-300, 0, 300], [-18, 0, 18])
  const doubleTap = useDoubleTap(useCallback(() => { onOpenModal?.(entry) }, [onOpenModal, entry]))

  function handleDragEnd(_: unknown, info: { offset: { x: number }; velocity: { x: number } }) {
    const cardWidth = window.innerWidth * 0.82
    const committed = Math.abs(info.offset.x) > cardWidth * THRESHOLD || Math.abs(info.velocity.x) > 400

    if (committed && info.offset.x > 0) {
      animate(x, 600, { duration: 0.25 })
      setTimeout(onEasy, 220)
    } else if (committed && info.offset.x < 0) {
      animate(x, -600, { duration: 0.25 })
      setTimeout(onHard, 220)
    } else {
      animate(x, 0, { type: 'spring', stiffness: 300, damping: 25 })
    }
  }

  return (
    <motion.div
      style={{ x, rotate }}
      drag={revealed ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      onDragEnd={revealed ? handleDragEnd : undefined}
      onTouchEnd={doubleTap.onTouchEnd}
      onClick={e => { doubleTap.onClick(e); if (!revealed) onReveal() }}
      className={`relative w-full select-none ${revealed ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
      animate={isConquering ? { scale: [1, 1.04, 1], transition: { duration: 0.4 } } : {}}
    >
      {/* Conquered glow ring */}
      {isConquering && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-[36px]"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: [0, 0.8, 0], scale: [0.95, 1.06, 1.12], transition: { duration: 0.5 } }}
          style={{ boxShadow: '0 0 0 3px rgba(180,160,255,0.9), 0 0 40px 8px rgba(180,160,255,0.5)' }}
        />
      )}

      <div className="relative rounded-[36px] shadow-[0_8px_48px_rgba(0,0,0,0.4),inset_0_0_0_1px_rgba(255,255,255,0.12)]">
        <GlassPane borderRadius={36} className="absolute inset-0 z-0 rounded-[36px] bg-white/[0.02]" />

        <div className="relative z-20 flex flex-col items-center gap-6 px-8 py-10">
          {/* Type badge */}
          <div className="relative flex items-center justify-center overflow-hidden rounded-[124px] border border-[#F8FAFC]/20 bg-[#F8FAFC]/10 px-[14px] py-[5px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]">
            <div
              className="absolute inset-0 z-0 flex items-center justify-center opacity-70 mix-blend-screen"
              dangerouslySetInnerHTML={{ __html: tagGradients[entry.type] ?? tagGradients['unknown'] }}
            />
            <span className="relative z-10 font-instrument text-[12px] font-medium capitalize text-[#F8FAFC]">
              {entry.type}
            </span>
          </div>

          {/* Polish word */}
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="font-instrument text-[48px] font-bold leading-none tracking-tight text-[#F8FAFC]">
              {entry.pl}
            </h1>
            {entry.type === 'noun' && entry.gender && (
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
                <div className="h-[1px] w-full bg-white/10" />
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
                <div className="h-[1px] w-full bg-white/10" />
                <div className="flex w-full items-center justify-between gap-3">
                  <p className="font-instrument text-[24px] font-medium text-[#B4A0FF]">{entry.en}</p>
                  <GlassButton
                    onClick={e => { e.stopPropagation(); onReplay() }}
                    radius={16}
                    pane="bg-white/5"
                    className={`h-[32px] w-[32px] flex-shrink-0 border border-white/10 ${ttsState === 'error' ? 'text-red-400/70' : 'text-white/30 hover:text-white/70'}`}
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
        onClick={onReset}
        radius={28}
        pane="bg-[#B4A0FF]/10"
        className="mt-2 border border-[#B4A0FF]/20 px-6 py-3 font-instrument text-[15px] font-medium text-[#B4A0FF]"
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
        onClick={onLapse}
        radius={28}
        pane="bg-red-400/10"
        className="flex-1 border border-red-400/20 py-4 font-instrument text-[15px] font-medium text-red-400/80"
      >
        <span className="material-symbols-rounded text-[18px]">replay</span>
        Again
      </GlassButton>
      <GlassButton
        onClick={onConquered}
        radius={28}
        pane="bg-[#B4A0FF]/10"
        className="flex-1 border border-[#B4A0FF]/20 py-4 font-instrument text-[15px] font-medium text-[#B4A0FF]"
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
      <div className="h-[4px] flex-1 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-[#B4A0FF]/60"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
      <span className="font-instrument text-[13px] tabular-nums text-white/30">
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
  const tts = useTTS()

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
    setQueue(q => q.slice(1))
    setRevealed(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Move current card to position ~3 in queue so it comes back soon in this session
  const requeueCurrent = useCallback(() => {
    tts.stop()
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
    saveReview(current.id, applyConquered(getOrInit(current.id)))
    setIsConquering(true)
    setTimeout(() => {
      setIsConquering(false)
      advance()
    }, 520)
  }

  function handleLapse() {
    if (!current) return
    saveReview(current.id, applyLapse(getOrInit(current.id)))
    requeueCurrent()
  }

  return (
    <div className="animate-fade-in flex w-full flex-col gap-6 pt-[24px]">
      {totalCount > 0 && (
        <ProgressBar done={doneCount} total={totalCount} />
      )}

      {current ? (
        <>
          <FlashCard
            key={current.id}
            entry={current}
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
  )
}
